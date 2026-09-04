/* Dev-only runtime smoke check for backend-driven demo CCTV playback.
 *
 * Renders the new stream-resolution path through react-dom/server so every
 * new component/branch executes: the centralized resolver, the reusable
 * StreamPlayer, the Dashboard feed tile scope (via LiveCameraCard), the
 * Live View wall card and the selected-camera preview — for a demo-playback
 * camera, a live real camera and an offline real camera.
 *
 * Usage:
 *   npx esbuild scripts/demo-playback-smoke.tsx --bundle --platform=node \
 *     --format=cjs --alias:@=./src --loader:.jpg=file \
 *     --define:import.meta.env='{"VITE_API_BASE_URL":"/api","VITE_DEMO_MODE":"false","VITE_STREAM_GATEWAY":"","VITE_WS_URL":""}' \
 *     --outfile=/tmp/demo-smoke.cjs && node /tmp/demo-smoke.cjs
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

const demoRegistry: RegistryCamera = {
  camera_id: 'DEMO-CAM-001',
  department: 'Ahmedabad Traffic Division (DEMO)',
  location_name: 'SG Highway @ Science City Road',
  latitude: 23.0225,
  longitude: 72.5714,
  camera_type: 'ANPR',
  codec: 'H.264',
  resolution: '1920x1080',
  status: 'active',
  connectivity: 'wired',
  vms: 'Unified VMS v4 (DEMO)',
  owner: 'Demo Seed Dataset',
  rtsp_configured: true,
  webrtc_configured: true,
  hls_configured: true,
  hls_path: '/api/streams/DEMO-CAM-001/hls/index.m3u8',
  live_frame_path: '/api/streams/DEMO-CAM-001/frame.jpg',
  live_mjpeg_path: '/api/streams/DEMO-CAM-001/live',
  demo_playback: true,
};

/* Mirrors the backend demo_stream_status() payload (state stays OFFLINE). */
const demoStream = {
  camera_id: 'DEMO-CAM-001',
  state: 'OFFLINE',
  rtsp_configured: true,
  codec: null,
  width: 640,
  height: 360,
  resolution: '640x360',
  source_fps: 5,
  measured_fps: 0,
  frame_count: 3,
  last_pts_ms: null,
  last_frame_at: null,
  last_error: null,
  reconnect_attempt: 0,
  next_retry_in_s: null,
  live_frame_path: '/api/streams/DEMO-CAM-001/frame.jpg',
  live_mjpeg_path: '/api/streams/DEMO-CAM-001/live',
  transport: 'demo',
  hls_configured: false,
  availability: 'OFFLINE',
  hls_path: null,
  demo_playback: true,
} as unknown as StreamStatusDto;

/* ---- centralized resolver ---- */
const demoPlayback = resolvePlaybackSource({ cameraId: 'DEMO-CAM-001', registry: demoRegistry, stream: demoStream });
assert(demoPlayback.kind === 'mjpeg', 'demo resolves to mjpeg playback');
assert(demoPlayback.url === '/api/streams/DEMO-CAM-001/live', 'demo URL comes from the API payload');
assert(demoPlayback.isDemoPlayback === true, 'demo flagged for DEMO badge');

const liveStream = {
  camera_id: 'cam99',
  state: 'LIVE',
  rtsp_configured: true,
  availability: 'ONLINE',
  measured_fps: 12,
  live_frame_path: '/api/streams/cam99/frame.jpg',
  live_mjpeg_path: '/api/streams/cam99/live',
} as unknown as StreamStatusDto;
const realPlayback = resolvePlaybackSource({ cameraId: 'cam99', registry: null, stream: liveStream });
assert(realPlayback.kind === 'mjpeg' && realPlayback.isDemoPlayback === false, 'live real camera plays without demo flag');

const deadStream = {
  camera_id: 'cam98',
  state: 'OFFLINE',
  rtsp_configured: false,
  availability: 'OFFLINE',
  measured_fps: 0,
  live_frame_path: '/api/streams/cam98/frame.jpg',
  live_mjpeg_path: '/api/streams/cam98/live',
} as unknown as StreamStatusDto;
const deadPlayback = resolvePlaybackSource({ cameraId: 'cam98', registry: null, stream: deadStream });
assert(deadPlayback.kind === 'none' && deadPlayback.url === null, 'offline real camera resolves to no-stream');

/* ---- merge hook output (what Dashboard + Live View consume) ---- */
const merged = mergeLiveCameras([demoRegistry], [demoStream], 7, false);
assert(merged.length === 1, 'demo registry camera merges to one tile');
assert(merged[0].liveFrameUrl === '/api/streams/DEMO-CAM-001/live', 'merged tile carries API MJPEG URL');
assert(merged[0].isDemoPlayback === true, 'merged tile flagged demo');
assert(merged[0].status === 'offline', 'physical stream state preserved (not faked online)');

/* ---- reusable player ---- */
const playerDemo = renderToString(
  <StreamPlayer kind="mjpeg" url="/api/streams/DEMO-CAM-001/live" title="DEMO-CAM-001" demo />,
);
assert(playerDemo.includes('/api/streams/DEMO-CAM-001/live'), 'player renders API stream URL');
assert(playerDemo.includes('Demo'), 'player renders DEMO indicator');

const playerNone = renderToString(<StreamPlayer kind="none" url={null} title="cam98" />);
assert(playerNone.includes('No stream'), 'unplayable source renders NO STREAM, not a crash');

/* ---- Live View wall card + selected panel ---- */
const demoCamera: LiveCamera = {
  ...merged[0],
  quality: 'HD',
  fps: 5,
  resolution: '640x360',
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
  <LiveCameraCard camera={demoCamera} selected muted={false} clock="12:00:00" tick={1} onSelect={() => undefined} onToggleMute={() => undefined} />,
);
assert(card.includes('/api/streams/DEMO-CAM-001/live'), 'wall card plays demo video (not SIGNAL LOST)');
assert(card.includes('DEMO'), 'wall card badges DEMO');
assert(!card.includes('SIGNAL LOST'), 'wall card does not show SIGNAL LOST for playable demo');

const panel = renderToString(<SelectedCameraPanel camera={demoCamera} clock="12:00:00" tick={1} />);
assert(panel.includes('/api/streams/DEMO-CAM-001/live'), 'selected panel plays demo video');
assert(panel.includes('DEMO'), 'selected panel badges DEMO');

const offlineCamera: LiveCamera = { ...demoCamera, isDemoPlayback: false, liveFrameUrl: undefined, thumbnail: '/api/streams/cam98/frame.jpg' };
const offlineCard = renderToString(
  <LiveCameraCard camera={offlineCamera} selected={false} muted={false} clock="12:00:00" tick={1} onSelect={() => undefined} onToggleMute={() => undefined} />,
);
assert(offlineCard.includes('SIGNAL LOST'), 'offline real camera keeps SIGNAL LOST state');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll demo-playback smoke assertions passed');
