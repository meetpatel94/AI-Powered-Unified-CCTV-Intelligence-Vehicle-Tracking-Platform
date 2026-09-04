/**
 * Video stream URL helpers.
 *
 * Browsers cannot play RTSP directly, so the AI/inference source (RTSP) is
 * NEVER sent to the browser. Browser preview is served two ways:
 *
 *  1. FastAPI Stream Gateway (always available, same-origin): in-memory JPEG
 *     (`frame.jpg`) and MJPEG (`live`) endpoints derived from the real RTSP
 *     frames — no RTSP credentials ever reach the client.
 *  2. An external WebRTC/HLS edge gateway (`VITE_STREAM_GATEWAY`) when one is
 *     deployed, re-publishing selected streams as HLS / WebRTC-WHEP. These are
 *     opt-in via config; when blank, only the JPEG/MJPEG gateway is used.
 *
 * All URLs are derived from a camera id — government camera URLs/coordinates
 * are never hard-coded.
 */

import { API_BASE, STREAM_GATEWAY } from '@/config';

/** HLS playout via the external edge gateway (requires VITE_STREAM_GATEWAY). */
export function toHlsUrl(cameraId: string): string {
  return `${STREAM_GATEWAY}/hls/${cameraId.toLowerCase()}/index.m3u8`;
}

/**
 * Same-origin HLS proxy served by the FastAPI backend (Sentinel Grid).
 *
 * The backend fetches the Sentinel playlist server-side and rewrites its
 * segment URIs onto this proxy, so the browser never sees the Sentinel origin,
 * an RTSP URL, or any credential. Preferred over `toHlsUrl` when no external
 * edge gateway is deployed.
 */
export function toBackendHlsUrl(cameraId: string): string {
  return `${API_BASE}/streams/${encodeURIComponent(cameraId)}/hls/index.m3u8`;
}

/** WebRTC (WHEP) endpoint for sub-second latency (requires VITE_STREAM_GATEWAY). */
export function toWhepUrl(cameraId: string): string {
  return `${STREAM_GATEWAY}/whep/${cameraId.toLowerCase()}`;
}

/** Still-frame endpoint used for alert/journey snapshots. */
export function toSnapshotUrl(cameraId: string, timestampIso: string): string {
  return `${STREAM_GATEWAY}/snapshot/${cameraId.toLowerCase()}?t=${encodeURIComponent(timestampIso)}`;
}

/** In-memory JPEG from the FastAPI stream gateway (Live View / AI overlays). */
export function toLiveFrameUrl(cameraId: string, bust?: number): string {
  const q = bust != null ? `?t=${bust}` : '';
  return `${API_BASE}/streams/${encodeURIComponent(cameraId)}/frame.jpg${q}`;
}

/** MJPEG preview endpoint from the FastAPI stream gateway. */
export function toLiveMjpegUrl(cameraId: string): string {
  return `${API_BASE}/streams/${encodeURIComponent(cameraId)}/live`;
}

/** True when an external WebRTC/HLS edge gateway is configured for preview. */
export function hasEdgeGateway(): boolean {
  return STREAM_GATEWAY.length > 0;
}
