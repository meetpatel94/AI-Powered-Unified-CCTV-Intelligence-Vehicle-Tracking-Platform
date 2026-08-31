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
  MapCameraNode,
  MapCameraStatus,
  MapCodec,
  TrackedVehicleRoute,
} from '@/types/cameraMap';

/* ------------------------------------------------------------------ *
 * Reference lists
 * ------------------------------------------------------------------ */

export const departments = ['Traffic Branch', 'City Crime Branch', 'Highway Patrol', 'Special Ops'];
export const codecs: MapCodec[] = ['H.264', 'H.265', 'MJPEG'];

export const statusFilters: Array<{ id: 'all' | MapCameraStatus; label: string; color: string }> = [
  { id: 'all', label: 'All', color: '#7db4ff' },
  { id: 'online', label: 'Online', color: '#22c55e' },
  { id: 'offline', label: 'Offline', color: '#64748b' },
  { id: 'warning', label: 'Warning', color: '#f59e0b' },
  { id: 'critical', label: 'Critical', color: '#ef4444' },
];

export const statusColor: Record<MapCameraStatus, string> = {
  online: '#17a349',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#64748b',
};

/** Fleet-wide counters for the statistics strip. */
export const fleetStats = {
  total: '12,842',
  online: { value: '11,243', pct: '87%' },
  offline: { value: '1,128', pct: '9%' },
  warning: { value: '471', pct: '4%' },
  activeAlerts: 12,
};

/* ------------------------------------------------------------------ *
 * Named cameras (the ones that appear across the whole platform)
 * ------------------------------------------------------------------ */

const named: MapCameraNode[] = [
  {
    id: 'C-001',
    x: 742,
    y: 486,
    location: 'Shahibaug Road',
    area: 'Shahibaug',
    city: 'Ahmedabad',
    department: 'Traffic Branch',
    status: 'online',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 25,
    latencyMs: 180,
    packetLoss: 0.1,
    lastHeartbeat: '2s ago',
    uptime: '18d 04h',
    vehiclesDetected: 412,
    lastPlate: 'GJ01KL4477',
    anpr: true,
    ai: true,
    thumbnail: camC001,
    events: [
      { time: '10:44:51 AM', text: 'ANPR read GJ01KL4477', tone: 'info' },
      { time: '10:41:12 AM', text: 'Congestion rose to Moderate', tone: 'warning' },
      { time: '10:21:15 AM', text: 'Tracked vehicle GJ01AB1234 sighted', tone: 'critical' },
    ],
  },
  {
    id: 'C-007',
    x: 640,
    y: 476,
    location: 'Naranpura Road',
    area: 'Naranpura',
    city: 'Ahmedabad',
    department: 'Traffic Branch',
    status: 'online',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 25,
    latencyMs: 210,
    packetLoss: 0.2,
    lastHeartbeat: '1s ago',
    uptime: '11d 22h',
    vehiclesDetected: 288,
    lastPlate: 'GJ01AB1234',
    anpr: true,
    ai: true,
    thumbnail: camC007,
    events: [
      { time: '10:28:42 AM', text: 'Tracked vehicle GJ01AB1234 sighted', tone: 'critical' },
      { time: '10:15:33 AM', text: 'AI model swapped to yolo-v8-traffic', tone: 'info' },
    ],
  },
  {
    id: 'C-015',
    x: 996,
    y: 330,
    location: 'Kudasan Road',
    area: 'Kudasan',
    city: 'Gandhinagar',
    department: 'Highway Patrol',
    status: 'online',
    codec: 'H.265',
    resolution: '2560x1440',
    fps: 30,
    latencyMs: 140,
    packetLoss: 0,
    lastHeartbeat: '1s ago',
    uptime: '31d 07h',
    vehiclesDetected: 356,
    lastPlate: 'GJ18CD4521',
    anpr: true,
    ai: true,
    thumbnail: camC015,
    events: [
      { time: '10:34:18 AM', text: 'Tracked vehicle GJ01AB1234 sighted', tone: 'critical' },
      { time: '10:09:58 AM', text: 'Heartbeat restored after 3s gap', tone: 'warning' },
    ],
  },
  {
    id: 'C-038',
    x: 1148,
    y: 352,
    location: 'Gift City Road',
    area: 'GIFT City',
    city: 'Gandhinagar',
    department: 'Special Ops',
    status: 'critical',
    codec: 'H.265',
    resolution: '2560x1440',
    fps: 30,
    latencyMs: 120,
    packetLoss: 0,
    lastHeartbeat: 'just now',
    uptime: '24d 16h',
    vehiclesDetected: 194,
    lastPlate: 'GJ01AB1234',
    anpr: true,
    ai: true,
    thumbnail: camC038,
    alertLabel: 'WATCHLIST MATCH',
    events: [
      { time: '10:44:03 AM', text: 'WATCHLIST MATCH — GJ01AB1234 (98.7%)', tone: 'critical' },
      { time: '10:44:03 AM', text: 'Snapshot pushed to case #4471', tone: 'info' },
      { time: '10:43:50 AM', text: 'Vehicle entered ANPR trigger zone', tone: 'warning' },
    ],
  },
  {
    id: 'C-045',
    x: 528,
    y: 634,
    location: 'Iskcon Circle',
    area: 'Satellite',
    city: 'Ahmedabad',
    department: 'Traffic Branch',
    status: 'online',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 24,
    latencyMs: 240,
    packetLoss: 0.4,
    lastHeartbeat: '3s ago',
    uptime: '6d 03h',
    vehiclesDetected: 501,
    anpr: false,
    ai: true,
    thumbnail: camC045,
    events: [{ time: '10:39:12 AM', text: 'Congestion rose to Heavy', tone: 'warning' }],
  },
  {
    id: 'C-052',
    x: 508,
    y: 580,
    location: 'Vastrapur Lake Road',
    area: 'Vastrapur',
    city: 'Ahmedabad',
    department: 'City Crime Branch',
    status: 'online',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 25,
    latencyMs: 195,
    packetLoss: 0.1,
    lastHeartbeat: '2s ago',
    uptime: '9d 11h',
    vehiclesDetected: 233,
    lastPlate: 'GJ01MN8890',
    anpr: true,
    ai: true,
    thumbnail: camC052,
    events: [{ time: '10:37:44 AM', text: 'ANPR read GJ01MN8890', tone: 'info' }],
  },
  {
    id: 'C-089',
    x: 726,
    y: 748,
    location: 'Maninagar Junction',
    area: 'Maninagar',
    city: 'Ahmedabad',
    department: 'City Crime Branch',
    status: 'warning',
    codec: 'H.264',
    resolution: '1280x720',
    fps: 18,
    latencyMs: 420,
    packetLoss: 1.8,
    lastHeartbeat: '6s ago',
    uptime: '2d 09h',
    vehiclesDetected: 128,
    anpr: false,
    ai: true,
    thumbnail: camC089,
    alertLabel: 'CROWD DETECTED',
    events: [
      { time: '10:35:20 AM', text: 'Crowd density above threshold (92%)', tone: 'warning' },
      { time: '10:30:02 AM', text: 'Packet loss 1.8% — degraded link', tone: 'warning' },
    ],
  },
  {
    id: 'C-115',
    x: 622,
    y: 596,
    location: 'S.G. Highway',
    area: 'Bodakdev',
    city: 'Ahmedabad',
    department: 'Highway Patrol',
    status: 'critical',
    codec: 'H.265',
    resolution: '2560x1440',
    fps: 30,
    latencyMs: 150,
    packetLoss: 0.1,
    lastHeartbeat: '1s ago',
    uptime: '44d 02h',
    vehiclesDetected: 738,
    lastPlate: 'GJ05JK6789',
    anpr: true,
    ai: true,
    thumbnail: camC115,
    alertLabel: 'SPEED VIOLATION',
    events: [
      { time: '10:42:11 AM', text: 'Speed violation 118 km/h — GJ05JK6789', tone: 'critical' },
      { time: '10:40:00 AM', text: 'e-Challan draft queued', tone: 'info' },
    ],
  },
  {
    id: 'C-131',
    x: 1298,
    y: 552,
    location: 'Dahegam Highway',
    area: 'Dahegam',
    city: 'Gandhinagar',
    department: 'Highway Patrol',
    status: 'online',
    codec: 'MJPEG',
    resolution: '1280x720',
    fps: 20,
    latencyMs: 380,
    packetLoss: 0.9,
    lastHeartbeat: '4s ago',
    uptime: '3d 18h',
    vehiclesDetected: 176,
    anpr: false,
    ai: true,
    thumbnail: camC131,
    events: [{ time: '10:26:31 AM', text: 'Low-light mode engaged', tone: 'info' }],
  },
  {
    id: 'C-160',
    x: 946,
    y: 872,
    location: 'Aslali Toll Plaza',
    area: 'Aslali',
    city: 'Ahmedabad',
    department: 'Highway Patrol',
    status: 'offline',
    codec: 'H.265',
    resolution: '1920x1080',
    fps: 0,
    latencyMs: 0,
    packetLoss: 100,
    lastHeartbeat: '38s ago',
    uptime: '—',
    vehiclesDetected: 0,
    anpr: true,
    ai: false,
    thumbnail: camC160,
    events: [
      { time: '10:43:58 AM', text: 'RTSP handshake retry 3/5', tone: 'warning' },
      { time: '10:43:20 AM', text: 'Stream dropped — edge link flap', tone: 'critical' },
    ],
  },
  {
    id: 'C-207',
    x: 1466,
    y: 926,
    location: 'Vadodara City Center',
    area: 'NE-1 Corridor',
    city: 'Vadodara',
    department: 'City Crime Branch',
    status: 'online',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 25,
    latencyMs: 205,
    packetLoss: 0.2,
    lastHeartbeat: '2s ago',
    uptime: '15d 12h',
    vehiclesDetected: 264,
    lastPlate: 'GJ06PQ2210',
    anpr: true,
    ai: true,
    thumbnail: camC207,
    events: [{ time: '10:38:55 AM', text: 'Wrong-direction vehicle GJ18CD4521', tone: 'warning' }],
  },
];

/* ------------------------------------------------------------------ *
 * Synthetic fleet spread across the metro (seeded → stable between renders)
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Corridors the synthetic cameras are scattered along. */
const corridors: Array<{ pts: Array<[number, number]>; area: string; city: string; road: string; spread: number }> = [
  { pts: [[806, 292], [700, 512], [574, 742], [512, 856]], area: 'Bodakdev', city: 'Ahmedabad', road: 'S.G. Highway', spread: 16 },
  { pts: [[690, 372], [678, 566], [666, 762]], area: 'Navrangpura', city: 'Ahmedabad', road: 'Ashram Road', spread: 12 },
  { pts: [[660, 300], [1000, 660], [610, 926], [320, 574], [660, 300]], area: 'Ring Road', city: 'Ahmedabad', road: 'Sardar Patel Ring Rd', spread: 22 },
  { pts: [[676, 600], [884, 442], [1044, 302]], area: 'Chandkheda', city: 'Gandhinagar', road: 'NH-147', spread: 16 },
  { pts: [[940, 130], [1180, 300]], area: 'Sector 21', city: 'Gandhinagar', road: 'Sector Road', spread: 26 },
  { pts: [[700, 700], [1000, 830], [1400, 960]], area: 'NE-1 Corridor', city: 'Ahmedabad', road: 'NE-1 Expressway', spread: 20 },
  { pts: [[-20, 880], [360, 792], [664, 676]], area: 'Sarkhej', city: 'Ahmedabad', road: 'NH-48', spread: 20 },
  { pts: [[420, 606], [706, 616], [916, 760]], area: 'Nikol', city: 'Ahmedabad', road: '132 Ft Ring Road', spread: 18 },
  { pts: [[1000, 660], [1250, 620], [1400, 604]], area: 'Dahegam', city: 'Gandhinagar', road: 'Dahegam Road', spread: 18 },
  { pts: [[560, 470], [800, 486]], area: 'Shahibaug', city: 'Ahmedabad', road: 'Shahibaug Road', spread: 12 },
];

const thumbnailPool = [camC001, camC007, camC015, camC045, camC052, camC089, camC115, camC131, camC160, camC207];
const plates = ['GJ01KL4477', 'GJ27RS3391', 'GJ03TU7745', 'GJ12VW1108', 'GJ38XY6620', 'GJ16ZA2284', 'GJ02BC9053'];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const synthetic: MapCameraNode[] = (() => {
  const rnd = mulberry32(778899);
  const out: MapCameraNode[] = [];
  let idSeq = 300;

  corridors.forEach((corridor, ci) => {
    const count = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const segF = t * (corridor.pts.length - 1);
      const seg = Math.min(Math.floor(segF), corridor.pts.length - 2);
      const localT = segF - seg;
      const [x1, y1] = corridor.pts[seg];
      const [x2, y2] = corridor.pts[seg + 1];
      const x = lerp(x1, x2, localT) + (rnd() - 0.5) * corridor.spread * 2;
      const y = lerp(y1, y2, localT) + (rnd() - 0.5) * corridor.spread * 2;

      const roll = rnd();
      const status: MapCameraStatus =
        roll > 0.93 ? 'offline' : roll > 0.83 ? 'warning' : roll > 0.79 ? 'critical' : 'online';
      const codec: MapCodec = rnd() > 0.62 ? 'H.265' : rnd() > 0.12 ? 'H.264' : 'MJPEG';
      const anpr = rnd() > 0.42;
      const down = status === 'offline';
      idSeq += 3 + Math.floor(rnd() * 5);

      out.push({
        id: `C-${idSeq}`,
        x: Math.round(x),
        y: Math.round(y),
        location: `${corridor.road} · Node ${i + 1}`,
        area: corridor.area,
        city: corridor.city,
        department: departments[(ci + i) % departments.length],
        status,
        codec,
        resolution: codec === 'H.265' ? '2560x1440' : rnd() > 0.5 ? '1920x1080' : '1280x720',
        fps: down ? 0 : [18, 20, 24, 25, 30][Math.floor(rnd() * 5)],
        latencyMs: down ? 0 : 110 + Math.floor(rnd() * 320),
        packetLoss: down ? 100 : Number((rnd() * 2).toFixed(1)),
        lastHeartbeat: down ? `${2 + Math.floor(rnd() * 20)}m ago` : `${1 + Math.floor(rnd() * 8)}s ago`,
        uptime: down ? '—' : `${1 + Math.floor(rnd() * 40)}d ${Math.floor(rnd() * 23)}h`,
        vehiclesDetected: down ? 0 : 60 + Math.floor(rnd() * 700),
        lastPlate: anpr && !down ? plates[Math.floor(rnd() * plates.length)] : undefined,
        anpr,
        ai: rnd() > 0.18,
        thumbnail: thumbnailPool[Math.floor(rnd() * thumbnailPool.length)],
        alertLabel: status === 'critical' ? (rnd() > 0.5 ? 'SPEED VIOLATION' : 'WRONG DIRECTION') : undefined,
        events: [
          {
            time: `10:${30 + Math.floor(rnd() * 15)}:${10 + Math.floor(rnd() * 49)} AM`,
            text: down
              ? 'Stream unreachable — field ticket raised'
              : status === 'critical'
                ? 'AI alert raised on this feed'
                : anpr
                  ? 'ANPR batch synced to central index'
                  : 'Health check passed',
            tone: down ? 'critical' : status === 'warning' ? 'warning' : 'info',
          },
          {
            time: `10:${10 + Math.floor(rnd() * 18)}:${10 + Math.floor(rnd() * 49)} AM`,
            text: 'Keyframe interval re-negotiated',
            tone: 'info',
          },
        ],
      });
    }
  });

  return out;
})();

export const mapCameraNodes: MapCameraNode[] = [...named, ...synthetic];

/* ------------------------------------------------------------------ *
 * Tracked vehicle journey
 * ------------------------------------------------------------------ */

export const trackedRoute: TrackedVehicleRoute = {
  plate: 'GJ01AB1234',
  type: 'White Swift Dzire',
  color: 'White',
  watchlist: true,
  legs: [
    { points: [[742, 486], [700, 480], [640, 476]] },
    { points: [[640, 476], [676, 440], [760, 404], [860, 372], [940, 344], [996, 330]] },
    { points: [[996, 330], [1060, 328], [1110, 340], [1148, 352]], critical: true },
  ],
  nodes: [
    {
      step: 1,
      cameraId: 'C-001',
      road: 'Shahibaug Road',
      city: 'Ahmedabad',
      time: '10:21:15 AM',
      x: 742,
      y: 486,
      thumbnail: camC001,
      speed: '48 km/h',
      direction: 'West',
    },
    {
      step: 2,
      cameraId: 'C-007',
      road: 'Naranpura Road',
      city: 'Ahmedabad',
      time: '10:28:42 AM',
      x: 640,
      y: 476,
      thumbnail: camC007,
      speed: '52 km/h',
      direction: 'North-West',
    },
    {
      step: 3,
      cameraId: 'C-015',
      road: 'Kudasan Road',
      city: 'Gandhinagar',
      time: '10:34:18 AM',
      x: 996,
      y: 330,
      thumbnail: camC015,
      speed: '74 km/h',
      direction: 'North-East',
    },
    {
      step: 4,
      cameraId: 'C-038',
      road: 'Gift City Road',
      city: 'Gandhinagar',
      time: '10:44:03 AM',
      x: 1148,
      y: 352,
      thumbnail: camC038,
      critical: true,
      speed: '62 km/h',
      direction: 'East',
    },
  ],
};

export const watchlistVehicles = [
  { plate: 'GJ01AB1234', type: 'White Swift Dzire', hits: 4, watchlist: true },
  { plate: 'GJ05JK6789', type: 'Silver Creta', hits: 2, watchlist: true },
  { plate: 'GJ18CD4521', type: 'Black Bolero', hits: 3, watchlist: false },
];

export const mapAlertPopup = {
  title: 'ALERT: Watchlist Match',
  vehicle: 'GJ01AB1234',
  camera: 'C-038',
  location: 'Gift City Road',
  time: '10:44:03 AM',
  confidence: '98.7%',
};

export const legendItems = [
  { label: 'Online', color: '#17a349', kind: 'dot' as const },
  { label: 'Warning / Poor Signal', color: '#f59e0b', kind: 'dot' as const },
  { label: 'Critical / Alert', color: '#ef4444', kind: 'dot' as const },
  { label: 'Offline', color: '#64748b', kind: 'dot' as const },
  { label: 'Camera Cluster', color: '#3b82f6', kind: 'cluster' as const },
  { label: 'Tracked Vehicle Route', color: '#38bdf8', kind: 'line' as const },
];
