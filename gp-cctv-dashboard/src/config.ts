/**
 * Central runtime configuration for the Gujarat Police command centre.
 *
 * Every service module reads its URLs/modes from here so there is a single,
 * authoritative definition instead of each file re-deriving `import.meta.env`
 * (and duplicating the old `/api/v1` vs `/api` split).
 *
 * Production contract
 * -------------------
 * - `VITE_API_BASE_URL` defaults to `/api`. The FastAPI backend serves every
 *   route under `/api/...` (there is NO `/api/v1` namespace). The dashboard is
 *   served same-origin through the reverse proxy, so `/api` is correct for
 *   both local `vite dev` (proxied) and the Docker/Nginx build.
 * - `VITE_DEMO_MODE` must NOT be `"true"` in production. When it is false (the
 *   default) the UI may never silently substitute bundled demo fixtures for
 *   operational data — it must show loading/error/offline states instead.
 * - `VITE_STREAM_GATEWAY` points at the external WebRTC/HLS edge gateway when
 *   one is deployed. When blank, browser previews fall back to the FastAPI
 *   stream gateway's in-memory JPEG/MJPEG endpoints (never raw RTSP).
 * - `VITE_WS_URL` overrides the realtime endpoint; when blank the realtime
 *   client connects to `/api/ws` on the current origin.
 */

/** Single production API base. The backend exposes NO `/api/v1` namespace. */
export const API_BASE: string =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api').replace(/\/+$/, '');

/**
 * Development/demo mode. When true, bundled demo fixtures may be shown behind
 * an explicit demo badge. When false (production default) no fabricated
 * operational data may be presented as real.
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * External WebRTC/HLS edge gateway base (e.g. MediaMTX/Janus). RTSP itself is
 * never exposed to the browser — this gateway re-publishes selected streams as
 * HLS / WebRTC-WHEP only.
 */
export const STREAM_GATEWAY: string = (import.meta.env.VITE_STREAM_GATEWAY as string | undefined) ?? '';

export interface RuntimeMode {
  demo: boolean;
  apiBase: string;
  streamGateway: string;
  wsUrl: string;
}

/** Human-readable description of the active runtime mode (for diagnostics/UI). */
export function describeRuntime(): RuntimeMode {
  return {
    demo: DEMO_MODE,
    apiBase: API_BASE,
    streamGateway: STREAM_GATEWAY,
    wsUrl: resolveWsUrl(),
  };
}

/** Resolve the realtime WebSocket URL on the current origin (proxied `/api/ws`). */
export function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws`;
}
