/* Dev-only runtime smoke check for the production LIVE playback flow.
 *
 * Renders the stream-resolution path through react-dom/server so every
 * relevant component/branch executes: the centralized resolver, the
 * reusable StreamPlayer (HLS + MJPEG + none), the Live View wall card and
 * the selected-camera preview — for a real Sentinel camera (HLS via the
 * backend proxy), a live gateway MJPEG camera, an offline camera and a
 * seeded DEMO-CAM-* row (which must NEVER be playable on the live wall).
 *
 * Usage:
 *   npx esbuild scripts/live-playback-smoke.tsx --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src --loader:.jpg=file \
 *     --define:import.meta.env='{"VITE_API_BASE_URL":"/api","VITE_DEMO_MODE":"false","VITE_STREAM_GATEWAY":"","VITE_WS_URL":""}' \
 *     --outfile=/tmp/live-smoke.cjs && node /tmp/live-smoke.cjs
 */
import { renderToString } from 'react-dom/server';

import { LiveCameraCard } from '@/components/liveview/LiveCameraCard';
import { SelectedCameraPanel } from '@/components/liveview/SelectedCameraPanel';
import { StreamPlayer } from '@/components/common/StreamPlayer';
import { mergeLiveCameras } from '@/hooks/useGatewayLiveCameras';
import { resolvePlaybackSource } from '@/services/streams';
import type { RegistryCamera, StreamStatusDto } from '@/services/api';
import type { LiveCamera } from '@/types/liveView';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

/* ---- real Sentinel camera (registry + stream payloads from the API) ---- */
const realRegistry: RegistryCamera = {
  camera_id: 'cam01',
  department: 'Ahmedabad Traffic Division',
  location_name: 'SG Highway @ Science City Road',
  latitude: 23.0225,
  longitude: 72.5714,
  camera_type: 'ANPR',
  codec: 'H.264',
  resolution: '1920x1080',
  status: 'active',
  connectivity: 'wired',
  vms: 'Unified VMS v4',
  owner: 'Gujarat Police',
  rtsp_configured: true,
  webrtc_configured: true,
  hls_configured: true,
  hls_path: '/api/streams/cam01/hls/index.m3u8',
  live_frame_path: '/api/streams/cam01/frame.jpg',
  live_mjpeg_path: '/api/streams/cam01/live',
  demo_playback: false,
};

/* Idle real camera: no FFmpeg worker, but the backend still advertises the
 * credential-free HLS proxy path (it resolves server-side to the camera's
 * real Sentinel https://cctv.corp8.cloud/cam01/index.m3u8 playlist). */
const realStream = {
  camera_id: 'cam01',
  state: 'OFFLINE',
  rtsp_configured: true,
  measured_fps: 0,
  live_frame_path: '/api/streams/cam01/frame.jpg',
  live_mjpeg_path: '/api/streams/cam01/live',
  hls_configured: true,
  availability: 'OFFLINE',
  hls_path: '/api/streams/cam01/hls/index.m3u8',
  demo_playback: false,
} as unknown as StreamStatusDto;

/* ---- seeded demo row (must never be playable on the live wall) ---- */
const demoRegistry: RegistryCamera = {
  ...realRegistry,
  camera_id: 'DEMO-CAM-001',
  location_name: 'Demo Seed Camera',
  hls_path: '/api/streams/DEMO-CAM-001/hls/index.m3u8',
  demo_playback: true,
};
const demoStream = {
  ...realStream,
  camera_id: 'DEMO-CAM-001',
  hls_path: null,
  demo_playback: true,
} as unknown as StreamStatusDto;

/* ---- centralized resolver ---- */
const realPlayback = resolvePlaybackSource({ cameraId: 'cam01', registry: realRegistry, stream: realStream });
assert(realPlayback.kind === 'hls', 'real camera resolves to HLS playback');
assert(realPlayback.url === '/api/streams/cam01/hls/index.m3u8', 'HLS URL comes from the API payload');
assert(realPlayback.isDemoPlayback === false, 'real camera is not flagged demo');

const demoPlayback = resolvePlaybackSource({ cameraId: 'DEMO-CAM-001', registry: demoRegistry, stream: demoStream });
assert(demoPlayback.kind === 'none', 'demo camera is NEVER playable (no synthetic feed)');
assert(demoPlayback.url === null, 'demo camera gets no playable URL');
assert(demoPlayback.isDemoPlayback === true, 'demo camera still carries the exclusion marker');

/* Live gateway worker without an HLS path → MJPEG fallback. */
const liveMjpegStream = {
  camera_id: 'cam99',
  state: 'LIVE',
  rtsp_configured: true,
  availability: 'ONLINE',
  measured_fps: 12,
  live_frame_path: '/api/streams/cam99/frame.jpg',
  live_mjpeg_path: '/api/streams/cam99/live',
  hls_path: null,
  demo_playback: false,
} as unknown as StreamStatusDto;
const mjpegPlayback = resolvePlaybackSource({ cameraId: 'cam99', registry: null, stream: liveMjpegStream });
assert(mjpegPlayback.kind === 'mjpeg' && mjpegPlayback.isDemoPlayback === false, 'live worker camera falls back to MJPEG');

/* Offline camera without HLS → no stream. */
const deadStream = {
  camera_id: 'cam98',
  state: 'OFFLINE',
  rtsp_configured: false,
  availability: 'OFFLINE',
  measured_fps: 0,
  live_frame_path: '/api/streams/cam98/frame.jpg',
  live_mjpeg_path: '/api/streams/cam98/live',
  hls_path: null,
  demo_playback: false,
} as unknown as StreamStatusDto;
const deadPlayback = resolvePlaybackSource({ cameraId: 'cam98', registry: null, stream: deadStream });
assert(deadPlayback.kind === 'none' && deadPlayback.url === null, 'offline real camera resolves to no-stream');

/* ---- merge hook output (what Dashboard + Live View consume) ---- */
const merged = mergeLiveCameras([realRegistry, demoRegistry], [realStream, demoStream], 7, false);
assert(merged.length === 1, 'seeded DEMO-CAM rows are excluded from the live wall');
assert(merged[0].id === 'cam01', 'the wall keeps the real Sentinel camera');
assert(merged[0].playbackKind === 'hls', 'merged tile plays HLS');
assert(merged[0].liveFrameUrl === '/api/streams/cam01/hls/index.m3u8', 'merged tile carries the backend HLS proxy URL');
assert(merged[0].isDemoPlayback !== true, 'merged real tile is not demo');
assert(merged[0].status === 'online', 'HLS-configured camera is viewable (live)');

const mergedAllReal = mergeLiveCameras([realRegistry], [realStream], 7, false);
assert(
  mergedAllReal[0].liveFrameUrl === '/api/streams/cam01/hls/index.m3u8',
  'production merge (no demo fixtures) still resolves the HLS URL',
);

/* ---- reusable player ---- */
const playerHls = renderToString(
  <StreamPlayer kind="hls" url="/api/streams/cam01/hls/index.m3u8" title="cam01" />,
);
assert(playerHls.includes('<video'), 'HLS source renders a <video> element');
assert(playerHls.includes('/api/streams/cam01/hls/index.m3u8'), 'player exposes the .m3u8 stream URL');
assert(playerHls.toLowerCase().includes('connecting'), 'HLS player shows a loading state');

const playerMjpeg = renderToString(
  <StreamPlayer kind="mjpeg" url="/api/streams/cam99/live" title="cam99" />,
);
assert(playerMjpeg.includes('/api/streams/cam99/live'), 'MJPEG player renders the API stream URL');

const playerNone = renderToString(<StreamPlayer kind="none" url={null} title="cam98" />);
assert(playerNone.includes('No stream'), 'unplayable source renders NO STREAM, not a crash');

/* ---- Live View wall card + selected panel ---- */
const hlsCamera: LiveCamera = {
  ...merged[0],
  quality: 'FHD',
  fps: 0,
  resolution: '1920x1080',
  codec: 'H.264',
  bitrateMbps: 0,
  latencyMs: 0,
  packetLoss: 0,
  uptime: '—',
  lastHeartbeat: '—',
  anprActive: false,
  aiDetection: false,
  detections: [],
  vehicleCount: 0,
  streamUrl: '',
  events: [],
};
const card = renderToString(
  <LiveCameraCard camera={hlsCamera} selected muted={false} clock="12:00:00" tick={1} onSelect={() => undefined} onToggleMute={() => undefined} />,
);
assert(card.includes('<video'), 'wall card renders the HLS <video> element');
assert(card.includes('/api/streams/cam01/hls/index.m3u8'), 'wall card plays the backend HLS proxy stream');
assert(!card.includes('SIGNAL LOST'), 'viewable HLS camera does not show SIGNAL LOST');
assert(!card.includes('DEMO'), 'wall card shows no DEMO badge for real cameras');

const panel = renderToString(<SelectedCameraPanel camera={hlsCamera} clock="12:00:00" tick={1} />);
assert(panel.includes('<video'), 'selected panel renders the HLS <video> element');
assert(panel.includes('/api/streams/cam01/hls/index.m3u8'), 'selected panel plays the backend HLS proxy stream');

const offlineCamera: LiveCamera = {
  ...hlsCamera,
  playbackKind: 'none',
  status: 'offline',
  liveFrameUrl: undefined,
  thumbnail: '/api/streams/cam98/frame.jpg',
};
const offlineCard = renderToString(
  <LiveCameraCard camera={offlineCamera} selected={false} muted={false} clock="12:00:00" tick={1} onSelect={() => undefined} onToggleMute={() => undefined} />,
);
assert(offlineCard.includes('SIGNAL LOST'), 'offline real camera without a stream keeps SIGNAL LOST state');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll live-playback smoke assertions passed');
