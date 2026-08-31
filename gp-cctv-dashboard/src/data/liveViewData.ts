import camC001 from '@/assets/cam-c001.jpg';
import camC007 from '@/assets/cam-c007.jpg';
import camC015 from '@/assets/cam-c015.jpg';
import camC038 from '@/assets/cam-c038.jpg';
import camC045 from '@/assets/cam-c045.jpg';
import camC052 from '@/assets/cam-c052.jpg';
import camC089 from '@/assets/cam-c089.jpg';
import camC115 from '@/assets/cam-c115.jpg';
import camC131 from '@/assets/cam-c131.jpg';
import camC160 from '@/assets/cam-c160.jpg';
import camC207 from '@/assets/cam-c207.jpg';

import type {
  AnprHit,
  DetectionBox,
  LiveCamera,
  StreamHealthMetric,
  CameraFilterId,
} from '@/types/liveView';

/* ------------------------------------------------------------------ *
 * Filter chips
 * ------------------------------------------------------------------ */

export const cameraFilters: Array<{ id: CameraFilterId; label: string }> = [
  { id: 'all', label: 'All Cameras' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
  { id: 'critical', label: 'Critical' },
  { id: 'anpr', label: 'ANPR Active' },
  { id: 'ai', label: 'AI Detection' },
];

export const locationOptions = [
  'All Locations',
  'Ahmedabad City',
  'Gandhinagar',
  'Vadodara',
  'Surat',
  'Rajkot',
];

export const departmentOptions = [
  'All Departments',
  'Traffic Branch',
  'City Crime Branch',
  'Highway Patrol',
  'Special Ops',
];

export const statusOptions = ['All Status', 'Online', 'Offline', 'Reconnecting', 'Critical'];
export const codecOptions = ['All Codecs', 'H.264', 'H.265', 'MJPEG'];

/* ------------------------------------------------------------------ *
 * Detection overlay helpers (percentage coordinates within the frame)
 * ------------------------------------------------------------------ */

const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  kind: DetectionBox['kind'] = 'vehicle',
  confidence?: number,
): DetectionBox => ({ x, y, w, h, label, kind, confidence });

/* ------------------------------------------------------------------ *
 * Camera fleet on the live wall
 * ------------------------------------------------------------------ */

export const liveCameras: LiveCamera[] = [
  {
    id: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    zone: 'Zone I · Shahibaug',
    department: 'Traffic Branch',
    thumbnail: camC001,
    status: 'online',
    quality: 'HD',
    fps: 25,
    resolution: '1920x1080',
    codec: 'H.264',
    bitrateMbps: 4.2,
    latencyMs: 180,
    packetLoss: 0.1,
    uptime: '18d 04h',
    lastHeartbeat: '2s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(31, 55, 22, 30, 'CAR 0.96'), box(58, 40, 14, 18, 'BIKE 0.88', 'bike')],
    vehicleCount: 412,
    lastPlate: 'GJ01KL4477',
    streamUrl: 'rtsp://gp-edge-01.gujpolice.local/stream/c-001',
    events: [
      { time: '10:44:51 AM', text: 'ANPR read GJ01KL4477', tone: 'info' },
      { time: '10:41:12 AM', text: 'Congestion level rose to Moderate', tone: 'warning' },
      { time: '10:22:04 AM', text: 'Stream re-keyed (H.264 IDR)', tone: 'info' },
    ],
  },
  {
    id: 'C-007',
    location: 'Naranpura Road',
    city: 'Ahmedabad',
    zone: 'Zone II · Naranpura',
    department: 'Traffic Branch',
    thumbnail: camC007,
    status: 'online',
    quality: 'HD',
    fps: 25,
    resolution: '1920x1080',
    codec: 'H.264',
    bitrateMbps: 3.8,
    latencyMs: 210,
    packetLoss: 0.2,
    uptime: '11d 22h',
    lastHeartbeat: '1s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(44, 48, 20, 26, 'CAR 0.94')],
    vehicleCount: 288,
    lastPlate: 'GJ01AB1234',
    streamUrl: 'rtsp://gp-edge-01.gujpolice.local/stream/c-007',
    events: [
      { time: '10:28:42 AM', text: 'Watchlist vehicle GJ01AB1234 passed', tone: 'critical' },
      { time: '10:15:33 AM', text: 'AI model swapped to yolo-v8-traffic', tone: 'info' },
    ],
  },
  {
    id: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    zone: 'Sector 11 · Kudasan',
    department: 'Highway Patrol',
    thumbnail: camC015,
    status: 'online',
    quality: 'FHD',
    fps: 30,
    resolution: '2560x1440',
    codec: 'H.265',
    bitrateMbps: 6.1,
    latencyMs: 140,
    packetLoss: 0.0,
    uptime: '31d 07h',
    lastHeartbeat: '1s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(48, 44, 18, 24, 'CAR 0.97'), box(20, 62, 12, 15, 'BIKE 0.81', 'bike')],
    vehicleCount: 356,
    lastPlate: 'GJ18CD4521',
    streamUrl: 'rtsp://gp-edge-04.gujpolice.local/stream/c-015',
    events: [
      { time: '10:34:18 AM', text: 'Watchlist vehicle GJ01AB1234 passed', tone: 'critical' },
      { time: '10:09:58 AM', text: 'Heartbeat restored after 3s gap', tone: 'warning' },
    ],
  },
  {
    id: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    zone: 'GIFT City · Gate 2',
    department: 'Special Ops',
    thumbnail: camC038,
    status: 'critical',
    quality: 'FHD',
    fps: 30,
    resolution: '2560x1440',
    codec: 'H.265',
    bitrateMbps: 6.8,
    latencyMs: 120,
    packetLoss: 0.0,
    uptime: '24d 16h',
    lastHeartbeat: 'just now',
    anprActive: true,
    aiDetection: true,
    detections: [box(41, 42, 26, 34, 'GJ01AB1234', 'anpr', 0.987)],
    vehicleCount: 194,
    lastPlate: 'GJ01AB1234',
    alertLabel: 'WATCHLIST MATCH',
    streamUrl: 'rtsp://gp-edge-04.gujpolice.local/stream/c-038',
    events: [
      { time: '10:44:03 AM', text: 'WATCHLIST MATCH — GJ01AB1234 (98.7%)', tone: 'critical' },
      { time: '10:44:03 AM', text: 'Snapshot pushed to Investigation case #4471', tone: 'info' },
      { time: '10:43:50 AM', text: 'Vehicle entered ANPR trigger zone', tone: 'warning' },
    ],
  },
  {
    id: 'C-045',
    location: 'Iskcon Circle',
    city: 'Ahmedabad',
    zone: 'Zone IV · Sarkhej',
    department: 'Traffic Branch',
    thumbnail: camC045,
    status: 'online',
    quality: 'HD',
    fps: 24,
    resolution: '1920x1080',
    codec: 'H.264',
    bitrateMbps: 3.6,
    latencyMs: 240,
    packetLoss: 0.4,
    uptime: '6d 03h',
    lastHeartbeat: '3s ago',
    anprActive: false,
    aiDetection: true,
    detections: [box(36, 52, 20, 26, 'CAR 0.91'), box(66, 58, 16, 20, 'AUTO 0.86', 'vehicle')],
    vehicleCount: 501,
    streamUrl: 'rtsp://gp-edge-02.gujpolice.local/stream/c-045',
    events: [{ time: '10:39:12 AM', text: 'Congestion level rose to Heavy', tone: 'warning' }],
  },
  {
    id: 'C-052',
    location: 'Vastrapur Lake Road',
    city: 'Ahmedabad',
    zone: 'Zone III · Vastrapur',
    department: 'City Crime Branch',
    thumbnail: camC052,
    status: 'online',
    quality: 'HD',
    fps: 25,
    resolution: '1920x1080',
    codec: 'H.264',
    bitrateMbps: 3.9,
    latencyMs: 195,
    packetLoss: 0.1,
    uptime: '9d 11h',
    lastHeartbeat: '2s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(52, 50, 18, 22, 'CAR 0.93')],
    vehicleCount: 233,
    lastPlate: 'GJ01MN8890',
    streamUrl: 'rtsp://gp-edge-02.gujpolice.local/stream/c-052',
    events: [{ time: '10:37:44 AM', text: 'ANPR read GJ01MN8890', tone: 'info' }],
  },
  {
    id: 'C-089',
    location: 'Maninagar Junction',
    city: 'Ahmedabad',
    zone: 'Zone VI · Maninagar',
    department: 'City Crime Branch',
    thumbnail: camC089,
    status: 'warning',
    quality: 'HD',
    fps: 18,
    resolution: '1280x720',
    codec: 'H.264',
    bitrateMbps: 2.4,
    latencyMs: 420,
    packetLoss: 1.8,
    uptime: '2d 09h',
    lastHeartbeat: '6s ago',
    anprActive: false,
    aiDetection: true,
    detections: [box(30, 46, 34, 38, 'CROWD 0.92', 'crowd'), box(70, 60, 14, 18, 'BIKE 0.79', 'bike')],
    vehicleCount: 128,
    alertLabel: 'CROWD DETECTED',
    streamUrl: 'rtsp://gp-edge-03.gujpolice.local/stream/c-089',
    events: [
      { time: '10:35:20 AM', text: 'Crowd density above threshold (92%)', tone: 'warning' },
      { time: '10:30:02 AM', text: 'Packet loss 1.8% — degraded link', tone: 'warning' },
    ],
  },
  {
    id: 'C-115',
    location: 'S.G. Highway',
    city: 'Ahmedabad',
    zone: 'Zone IV · Bodakdev',
    department: 'Highway Patrol',
    thumbnail: camC115,
    status: 'critical',
    quality: 'FHD',
    fps: 30,
    resolution: '2560x1440',
    codec: 'H.265',
    bitrateMbps: 7.2,
    latencyMs: 150,
    packetLoss: 0.1,
    uptime: '44d 02h',
    lastHeartbeat: '1s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(30, 48, 24, 30, 'GJ05JK6789', 'anpr', 0.961), box(64, 40, 15, 19, 'CAR 0.9')],
    vehicleCount: 738,
    lastPlate: 'GJ05JK6789',
    alertLabel: 'SPEED VIOLATION',
    streamUrl: 'rtsp://gp-edge-02.gujpolice.local/stream/c-115',
    events: [
      { time: '10:42:11 AM', text: 'Speed violation 118 km/h — GJ05JK6789', tone: 'critical' },
      { time: '10:40:00 AM', text: 'e-Challan draft queued', tone: 'info' },
    ],
  },
  {
    id: 'C-131',
    location: 'Kalawad Road',
    city: 'Rajkot',
    zone: 'Rajkot West',
    department: 'Traffic Branch',
    thumbnail: camC131,
    status: 'online',
    quality: 'SD',
    fps: 20,
    resolution: '1280x720',
    codec: 'MJPEG',
    bitrateMbps: 1.9,
    latencyMs: 380,
    packetLoss: 0.9,
    uptime: '3d 18h',
    lastHeartbeat: '4s ago',
    anprActive: false,
    aiDetection: true,
    detections: [box(46, 54, 20, 24, 'CAR 0.84')],
    vehicleCount: 176,
    streamUrl: 'rtsp://gp-edge-07.gujpolice.local/stream/c-131',
    events: [{ time: '10:26:31 AM', text: 'Low-light mode engaged', tone: 'info' }],
  },
  {
    id: 'C-160',
    location: 'Ring Road',
    city: 'Surat',
    zone: 'Surat Central',
    department: 'Highway Patrol',
    thumbnail: camC160,
    status: 'reconnecting',
    quality: 'HD',
    fps: 0,
    resolution: '1920x1080',
    codec: 'H.265',
    bitrateMbps: 0,
    latencyMs: 0,
    packetLoss: 12.4,
    uptime: '0d 00h',
    lastHeartbeat: '38s ago',
    anprActive: true,
    aiDetection: false,
    detections: [],
    vehicleCount: 0,
    streamUrl: 'rtsp://gp-edge-11.gujpolice.local/stream/c-160',
    events: [
      { time: '10:43:58 AM', text: 'RTSP handshake retry 3/5', tone: 'warning' },
      { time: '10:43:20 AM', text: 'Stream dropped — edge link flap', tone: 'critical' },
    ],
  },
  {
    id: 'C-207',
    location: 'Vadodara City Center',
    city: 'Vadodara',
    zone: 'Raopura',
    department: 'City Crime Branch',
    thumbnail: camC207,
    status: 'online',
    quality: 'HD',
    fps: 25,
    resolution: '1920x1080',
    codec: 'H.264',
    bitrateMbps: 4.0,
    latencyMs: 205,
    packetLoss: 0.2,
    uptime: '15d 12h',
    lastHeartbeat: '2s ago',
    anprActive: true,
    aiDetection: true,
    detections: [box(38, 50, 22, 26, 'CAR 0.95'), box(72, 55, 12, 16, 'PERSON 0.87', 'person')],
    vehicleCount: 264,
    lastPlate: 'GJ06PQ2210',
    streamUrl: 'rtsp://gp-edge-09.gujpolice.local/stream/c-207',
    events: [{ time: '10:38:55 AM', text: 'Wrong-direction vehicle GJ18CD4521', tone: 'warning' }],
  },
  {
    id: 'C-233',
    location: 'Vidyanagar Road',
    city: 'Anand',
    zone: 'Anand East',
    department: 'Traffic Branch',
    thumbnail: camC052,
    status: 'offline',
    quality: 'SD',
    fps: 0,
    resolution: '1280x720',
    codec: 'H.264',
    bitrateMbps: 0,
    latencyMs: 0,
    packetLoss: 100,
    uptime: '—',
    lastHeartbeat: '14m 22s ago',
    anprActive: false,
    aiDetection: false,
    detections: [],
    vehicleCount: 0,
    streamUrl: 'rtsp://gp-edge-13.gujpolice.local/stream/c-233',
    events: [
      { time: '10:30:41 AM', text: 'Camera unreachable — power/link fault', tone: 'critical' },
      { time: '10:30:39 AM', text: 'Ticket GP-INC-2261 raised to field team', tone: 'info' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Live ANPR OCR feed (seed rows; the panel appends simulated reads)
 * ------------------------------------------------------------------ */

export const anprSeed: AnprHit[] = [
  { id: 'h1', plate: 'GJ01AB1234', camera: 'C-038', time: '10:44:03', confidence: 98.7, watchlist: true },
  { id: 'h2', plate: 'GJ05JK6789', camera: 'C-115', time: '10:43:47', confidence: 96.1, watchlist: true },
  { id: 'h3', plate: 'GJ18CD4521', camera: 'C-015', time: '10:43:29', confidence: 94.4 },
  { id: 'h4', plate: 'GJ01KL4477', camera: 'C-001', time: '10:43:11', confidence: 92.8 },
  { id: 'h5', plate: 'GJ06PQ2210', camera: 'C-207', time: '10:42:58', confidence: 91.2 },
  { id: 'h6', plate: 'GJ01MN8890', camera: 'C-052', time: '10:42:35', confidence: 89.6 },
];

/** Plate pool used by the simulated OCR stream. */
export const platePool = [
  'GJ01AB1234',
  'GJ05JK6789',
  'GJ18CD4521',
  'GJ01KL4477',
  'GJ06PQ2210',
  'GJ01MN8890',
  'GJ27RS3391',
  'GJ03TU7745',
  'GJ12VW1108',
  'GJ38XY6620',
  'GJ16ZA2284',
  'GJ02BC9053',
];

export const watchlistPlates = new Set(['GJ01AB1234', 'GJ05JK6789']);

/* ------------------------------------------------------------------ *
 * Stream health
 * ------------------------------------------------------------------ */

export const streamHealthMetrics: StreamHealthMetric[] = [
  { id: 'fps', label: 'Avg FPS', value: '24.6', sub: 'target 25', tone: 'green', pct: 92 },
  { id: 'latency', label: 'Avg Latency', value: '186 ms', sub: 'edge → wall', tone: 'green', pct: 78 },
  { id: 'loss', label: 'Packet Loss', value: '0.6%', sub: 'last 5 min', tone: 'amber', pct: 24 },
  { id: 'bitrate', label: 'Ingest', value: '48.9 Mb/s', sub: '12 streams', tone: 'blue', pct: 66 },
];

export const streamStates = [
  { id: 'online', label: 'Online', count: 9, color: '#22c55e' },
  { id: 'reconnecting', label: 'Reconnecting', count: 1, color: '#f59e0b' },
  { id: 'offline', label: 'Offline', count: 1, color: '#ef4444' },
  { id: 'degraded', label: 'Degraded', count: 1, color: '#eab308' },
];

/** Fleet-wide counters shown in the page header. */
export const fleetSummary = {
  liveCameras: 12,
  onlineTotal: 11243,
  offlineTotal: 1128,
  recording: true,
};
