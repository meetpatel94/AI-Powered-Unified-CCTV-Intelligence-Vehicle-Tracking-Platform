/**
 * Video stream helpers.
 *
 * Browsers cannot play RTSP directly, so the field cameras are expected to be
 * re-published by an edge gateway (MediaMTX / Janus / Kurento) as either
 * low-latency HLS or WebRTC. `LiveFeedsPanel` renders static thumbnails today;
 * when the gateway is live, drop an <video> element in and resolve its src with
 * the helpers below.
 */

const GATEWAY = import.meta.env.VITE_STREAM_GATEWAY ?? '';

/** rtsp://edge/stream/c-001 -> https://gateway/hls/c-001/index.m3u8 */
export function toHlsUrl(cameraId: string): string {
  return `${GATEWAY}/hls/${cameraId.toLowerCase()}/index.m3u8`;
}

/** WebRTC (WHEP) endpoint for sub-second latency on the operator wall. */
export function toWhepUrl(cameraId: string): string {
  return `${GATEWAY}/whep/${cameraId.toLowerCase()}`;
}

/** Still-frame endpoint used for alert/journey snapshots. */
export function toSnapshotUrl(cameraId: string, timestampIso: string): string {
  return `${GATEWAY}/snapshot/${cameraId.toLowerCase()}?t=${encodeURIComponent(timestampIso)}`;
}
