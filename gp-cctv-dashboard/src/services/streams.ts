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

/* ------------------------------------------------------------------ *
 * Centralized stream-source resolution.
 *
 * This is the ONLY place that decides which browser-compatible stream URL
 * a camera plays. Dashboard, Live View and the selected-camera panel all
 * resolve through here — no component sniffs camera ids or hard-codes
 * stream URLs.
 *
 * The decision is driven by backend/API fields (the credential-free
 * `hls_path` / `live_*_path` playback paths + the `demo_playback` marker
 * flag), never by frontend id prefix checks or hard-coded hosts/ports:
 *
 * - REAL cameras (Sentinel `camNN` fleet) play the backend's same-origin
 *   HLS proxy (`hls_path` → `/api/streams/{id}/hls/index.m3u8`), which
 *   resolves server-side to the real Sentinel playlist
 *   `https://cctv.corp8.cloud/{camera_id}/index.m3u8`. HLS is the primary
 *   live source because it comes straight from the Control Room / Sentinel
 *   infrastructure and needs no FFmpeg worker.
 * - When no HLS path exists but the stream gateway reports a live worker,
 *   the in-memory MJPEG preview (`live_mjpeg_path`) is used, exactly as
 *   before.
 * - Seeded demo cameras (`demo_playback: true` marker) are NEVER given a
 *   playable source — the production live wall must only ever play real
 *   backend-provided streams. They resolve to `kind: 'none'` so the UI
 *   renders the existing NO STREAM / SIGNAL LOST state (and callers
 *   exclude them from the camera wall entirely).
 * - Anything else resolves to `kind: 'none'` (never throws, never a broken
 *   player element).
 * ------------------------------------------------------------------ */

export type PlaybackKind = 'mjpeg' | 'hls' | 'none';

export interface PlaybackSource {
  kind: PlaybackKind;
  /** Browser-compatible stream URL (MJPEG/HLS) — null when unplayable. */
  url: string | null;
  /** Still-frame URL for thumbnails/snapshots. */
  frameUrl: string;
  /**
   * True when the backend marked this camera as a seeded demo row. This is
   * an exclusion marker only — demo cameras are never playable here.
   */
  isDemoPlayback: boolean;
  /** Same-origin HLS playlist when the backend provides one (real cameras). */
  hlsUrl: string | null;
}

interface PlaybackInputs {
  cameraId: string;
  registry?: {
    live_frame_path?: string | null;
    live_mjpeg_path?: string | null;
    hls_path?: string | null;
    demo_playback?: boolean;
  } | null;
  stream?: {
    state?: string;
    availability?: string;
    live_frame_path?: string;
    live_mjpeg_path?: string;
    hls_path?: string | null;
    demo_playback?: boolean;
  } | null;
  frameBust?: number;
}

const LIVE_STATES = new Set(['LIVE', 'ONLINE', 'RECONNECTING', 'CONNECTING']);

export function resolvePlaybackSource(inputs: PlaybackInputs): PlaybackSource {
  const { cameraId, registry, stream, frameBust } = inputs;
  const mjpegUrl =
    stream?.live_mjpeg_path ?? registry?.live_mjpeg_path ?? toLiveMjpegUrl(cameraId);
  const frameUrl =
    stream?.live_frame_path ??
    registry?.live_frame_path ??
    toLiveFrameUrl(cameraId, frameBust);
  const hlsUrl = stream?.hls_path ?? registry?.hls_path ?? null;
  const isDemoPlayback = stream?.demo_playback === true || registry?.demo_playback === true;

  // Seeded demo rows are never playable on the production live path — no
  // synthetic/demo feed is resolved, regardless of any seeded URL.
  if (isDemoPlayback) {
    return { kind: 'none', url: null, frameUrl, isDemoPlayback: true, hlsUrl: null };
  }

  // Real cameras: the backend HLS proxy is the primary live source. It is
  // handed to us by the API (never constructed from a camera id here) and
  // resolves server-side to the camera's actual Sentinel HLS playlist.
  if (hlsUrl) {
    return { kind: 'hls', url: hlsUrl, frameUrl, isDemoPlayback: false, hlsUrl };
  }

  // No HLS source: fall back to the gateway MJPEG preview when the worker
  // reports a live/connecting stream (RTSP → FFmpeg → MJPEG path).
  const live = !!stream && LIVE_STATES.has((stream.availability ?? stream.state ?? '').toUpperCase());
  if (live) {
    return { kind: 'mjpeg', url: mjpegUrl, frameUrl, isDemoPlayback: false, hlsUrl };
  }

  return { kind: 'none', url: null, frameUrl, isDemoPlayback: false, hlsUrl };
}

/** True when an external WebRTC/HLS edge gateway is configured for preview. */
export function hasEdgeGateway(): boolean {
  return STREAM_GATEWAY.length > 0;
}
