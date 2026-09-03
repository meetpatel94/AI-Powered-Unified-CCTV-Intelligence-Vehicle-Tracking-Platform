/**
 * Realtime event client for the Gujarat Police CCTV Intelligence backend.
 *
 * Backend contract (`/api/ws`, see `backend/app/api/intelligence.py`) — every
 * frame is `{ event, payload }`. Topics mirror the Vehicle Intelligence
 * Pipeline / Watchlist / Alerts / Camera-health event hub:
 *
 *   detection, anpr:hit, track, journey,
 *   watchlist:match, alert:new, alert:ack, alert:update,
 *   camera:state, camera:health, kpi:tick, analytics:tick
 *
 * This module owns ONE shared WebSocket for the whole SPA:
 *   - multiple `createRealtimeChannel()` handles share a single connection
 *     (no duplicate sockets / duplicate deliveries);
 *   - auto-(re)connect with exponential backoff (~2s → 30s) and automatic
 *     teardown when the last channel closes;
 *   - exposes a connection-status subscription so the UI can show a real
 *     "connecting / reconnecting / open / offline" state instead of silently
 *     pretending data is live.
 *
 * No synthetic events are generated here — every frame is real backend output.
 */

import { resolveWsUrl } from '@/config';

export type RealtimeEvent =
  | 'alert:new'
  | 'alert:ack'
  /** Alert lifecycle update (acknowledge / status / resolve / auto-resolve). */
  | 'alert:update'
  | 'camera:state'
  | 'anpr:hit'
  | 'kpi:tick'
  | 'analytics:tick'
  | 'investigation:tick'
  /** Watchlist match raised from a genuine ANPR sighting. */
  | 'watchlist:match'
  /** Per-camera stream health frame (fps, latency, loss, RTSP/WebRTC/HLS state). */
  | 'camera:health'
  /* Vehicle Intelligence Pipeline topics (served by backend `/api/ws`). */
  | 'detection'
  | 'track'
  | 'journey';

type Handler = (payload: unknown) => void;

export interface RealtimeChannel {
  on: (event: RealtimeEvent, handler: Handler) => () => void;
  close: () => void;
}

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Known server topics — frames whose `event` is not recognised are ignored. */
const KNOWN_EVENTS = new Set<RealtimeEvent>([
  'alert:new',
  'alert:ack',
  'alert:update',
  'camera:state',
  'anpr:hit',
  'kpi:tick',
  'analytics:tick',
  'investigation:tick',
  'watchlist:match',
  'camera:health',
  'detection',
  'track',
  'journey',
]);

/** Access-token persistence shared with the API layer (auth deployments). */
const TOKEN_STORAGE_KEY = 'gp.cctv.access_token';

export function storeAccessToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable — token stays in memory only */
  }
}

export function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Shared connection state (module scope — one socket for the whole app)
 * ------------------------------------------------------------------ */
const handlers = new Map<RealtimeEvent, Set<Handler>>();
const statusListeners = new Set<(status: RealtimeStatus) => void>();

let socket: WebSocket | null = null;
let status: RealtimeStatus = 'idle';
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
let refCount = 0;
let stopped = true;

const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;

function setStatus(next: RealtimeStatus): void {
  status = next;
  statusListeners.forEach((listener) => listener(status));
}

/** Subscribe to the shared connection status. Returns an unsubscribe fn. */
export function onRealtimeStatus(listener: (status: RealtimeStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

/** Current shared connection status. */
export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** True only while the socket is actually open (events are really live). */
export function isRealtimeOpen(): boolean {
  return status === 'open';
}

function dispatch(event: RealtimeEvent, payload: unknown): void {
  handlers.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch {
      /* a handler's error must not break the shared socket */
    }
  });
}

function clearReconnectTimer(): void {
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  clearReconnectTimer();
  if (stopped) return;
  const delay = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_MIN_MS * 2 ** reconnectAttempts,
  );
  reconnectAttempts += 1;
  setStatus('reconnecting');
  reconnectTimer = window.setTimeout(connect, delay);
}

function connect(): void {
  if (stopped || socket) return;
  let url: string;
  try {
    url = buildWsUrl();
  } catch {
    setStatus('closed');
    return;
  }
  if (!url) {
    setStatus('closed');
    return;
  }
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;
  setStatus('connecting');

  ws.onopen = () => {
    if (socket !== ws) return;
    reconnectAttempts = 0;
    setStatus('open');
  };

  ws.onmessage = (message) => {
    if (socket !== ws) return;
    try {
      const parsed = JSON.parse(message.data as string) as { event?: unknown; payload?: unknown };
      if (!parsed || typeof parsed.event !== 'string') return;
      const event = parsed.event as RealtimeEvent;
      if (!KNOWN_EVENTS.has(event)) return; // ignore unknown/foreign topics
      dispatch(event, parsed.payload);
    } catch {
      /* ignore malformed / non-JSON frames (e.g. MJPEG is not on this socket) */
    }
  };

  ws.onerror = () => {
    /* onclose drives reconnection — keep this no-op minimal */
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (!stopped) scheduleReconnect();
    else setStatus('closed');
  };
}

/** Resolve `/api/ws` on the current origin and attach the auth token (if any). */
function buildWsUrl(): string {
  const base = resolveWsUrl();
  if (!base) return '';
  const token = readStoredToken();
  return token ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : base;
}

/** Open the shared connection when the first channel is created. */
function ensureConnected(): void {
  stopped = false;
  if (!socket && reconnectTimer == null) connect();
}

/** Close the shared connection when the last channel goes away. */
function releaseConnection(): void {
  if (refCount > 0) return;
  stopped = true;
  clearReconnectTimer();
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  handlers.clear();
  reconnectAttempts = 0;
  setStatus('closed');
}

export function createRealtimeChannel(): RealtimeChannel {
  refCount += 1;
  ensureConnected();

  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set<Handler>();
        handlers.set(event, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
    close() {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0) releaseConnection();
    },
  };
}
