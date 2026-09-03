/**
 * Realtime channel stub (alerts, camera state, ANPR hits).
 *
 * Usage once the gateway exists:
 *   const bus = createRealtimeChannel();
 *   bus.on('alert:new', (payload) => ...);
 */

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

/** Resolve the realtime WebSocket URL.
 *
 * Defaults to the backend pipeline feed at `/api/ws` on the current origin
 * (proxied by Vite in dev), so realtime works out-of-the-box. Override with
 * `VITE_WS_URL` to point at an external gateway. */
function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${proto}//${window.location.host}/api/ws`;
  // When the backend runs with AUTH_ENABLED=true, browsers cannot set
  // WebSocket headers — pass the stored access token as a query parameter.
  const token = readStoredToken();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

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

const WS_URL = resolveWsUrl();

export function createRealtimeChannel(): RealtimeChannel {
  const handlers = new Map<RealtimeEvent, Set<Handler>>();
  let socket: WebSocket | null = null;

  if (WS_URL) {
    try {
      socket = new WebSocket(WS_URL);
    } catch {
      socket = null;
    }
    if (socket) {
      socket.onmessage = (message) => {
        try {
          const { event, payload } = JSON.parse(message.data) as {
            event: RealtimeEvent;
            payload: unknown;
          };
          handlers.get(event)?.forEach((handler) => handler(payload));
        } catch {
          // ignore malformed frames
        }
      };
      socket.onerror = () => {
        // Non-fatal: components keep their last state / mock fallback.
      };
    }
  }

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return () => set.delete(handler);
    },
    close() {
      socket?.close();
      handlers.clear();
    },
  };
}
