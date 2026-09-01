import { Cpu, PlugZap, Radio, RotateCw, Signal, WifiOff } from 'lucide-react';

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

import { mapCameraNodes } from '@/data/cameraMapData';
import { worldToLatLng } from '@/data/gisProjection';
import { distribute } from '@/components/analytics/chartMath';
import { drift } from '@/hooks/useTelemetryTick';

import type {
  CriticalCamera,
  FleetHealth,
  HealthCamera,
  HealthCodec,
  HealthEvaluation,
  HealthEvent,
  HealthFilters,
  HealthSettings,
  HealthSortKey,
  HealthStatus,
  LocationHealthRow,
  MetricTone,
  QualityPoint,
  ResolutionClass,
  SortDir,
  StatusSlice,
  StreamQualitySeries,
  StreamTransport,
} from '@/types/cameraHealth';

/* ------------------------------------------------------------------ *
 * Reference clock — 10:46:03 AM, 01 Sep 2026, the console's shared "now".
 * ------------------------------------------------------------------ */

const BASE = 10 * 3600 + 46 * 60 + 3;

export const t = (h: number, m: number, s: number) => h * 3600 + m * 60 + s;

export function clockOf(seconds: number): string {
  const s = ((seconds % 86400) + 86400) % 86400;
  const h24 = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(sec)} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function agoOf(seconds: number): string {
  const diff = Math.max(0, BASE - seconds);
  if (diff < 60) return `${diff} s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${(mins / 60).toFixed(1)} hr ago`;
}

/* ------------------------------------------------------------------ *
 * Fleet totals. Online + Offline + Poor Signal is an exact partition of the
 * fleet; Reconnecting and Critical are live sub-states inside those buckets
 * (a camera retrying its stream is counted in Poor Signal, a camera needing an
 * operator is counted in Offline or Poor Signal) so nothing is double counted.
 * ------------------------------------------------------------------ */

export const fleetHealth: FleetHealth = {
  total: 12842,
  online: 11243,
  offline: 1128,
  poor: 471,
  reconnecting: 86,
  critical: 214,
  avgLatencyMs: 186,
  avgFps: 24.6,
  ingestMbps: 48.9,
  anprReadsToday: 14382,
};

export const defaultHealthSettings: HealthSettings = {
  latencyWarnMs: 300,
  latencyCritMs: 600,
  lossWarnPct: 1,
  lossCritPct: 3,
  fpsMinPct: 80,
  heartbeatWarnSec: 10,
  refreshSec: 2,
  autoRestart: true,
  notifyCritical: true,
  anprAlerts: true,
};

export const statusMeta: Record<HealthStatus, { label: string; color: string; chip: string; dot: string }> = {
  online: {
    label: 'Online',
    color: '#22c55e',
    chip: 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]',
    dot: 'bg-accent-green',
  },
  offline: {
    label: 'Offline',
    color: '#ef4444',
    chip: 'border-accent-red/50 bg-[#2b0b10] text-[#ff8b96]',
    dot: 'bg-accent-red',
  },
  poor: {
    label: 'Poor Signal',
    color: '#f59e0b',
    chip: 'border-accent-orange/50 bg-[#2b1a06] text-[#f7b95f]',
    dot: 'bg-accent-orange',
  },
  reconnecting: {
    label: 'Reconnecting',
    color: '#2f7dff',
    chip: 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]',
    dot: 'bg-accent-blue',
  },
  critical: {
    label: 'Critical',
    color: '#dc2626',
    chip: 'border-[#7f1d1d] bg-[#350a10] text-[#ffb3ba]',
    dot: 'bg-[#dc2626]',
  },
};

export const transportMeta: Record<StreamTransport, { label: string; tone: MetricTone }> = {
  live: { label: 'RTSP live', tone: 'green' },
  degraded: { label: 'Degraded', tone: 'amber' },
  reconnecting: { label: 'Reconnecting', tone: 'cyan' },
  lost: { label: 'Stream lost', tone: 'red' },
};

/* ------------------------------------------------------------------ *
 * Monitored camera set — identities come from the GIS camera registry so
 * IDs, locations, departments, codecs and thumbnails stay consistent with
 * Camera Map / Live View. Health-specific telemetry is authored here.
 * ------------------------------------------------------------------ */

const registry = new Map(mapCameraNodes.map((camera) => [camera.id, camera]));

const thumbnails: Record<string, string> = {
  'C-001': camC001,
  'C-007': camC007,
  'C-015': camC015,
  'C-038': camC038,
  'C-045': camC045,
  'C-052': camC052,
  'C-089': camC089,
  'C-115': camC115,
  'C-131': camC131,
  'C-160': camC160,
  'C-207': camC207,
};

const zones: Record<string, string> = {
  Shahibaug: 'Zone I · Shahibaug',
  Navrangpura: 'Zone II · Navrangpura',
  Naranpura: 'Zone II · Naranpura',
  Bodakdev: 'Zone IV · Bodakdev',
  Vastrapur: 'Zone III · Vastrapur',
  Satellite: 'Zone IV · Sarkhej',
  Maninagar: 'Zone VI · Maninagar',
  Aslali: 'Zone VII · Aslali',
  Chandkheda: 'Gandhinagar South · Chandkheda',
  Kudasan: 'Gandhinagar North · Kudasan',
  'Sector 21': 'Gandhinagar Sector 21',
  'GIFT City': 'Gandhinagar Sector 28',
  Dahegam: 'Gandhinagar East · Dahegam',
  'NE-1 Corridor': 'Vadodara · NE-1 Corridor',
};

const resolutionClassOf = (resolution: string): ResolutionClass => {
  if (resolution.includes('3840')) return '4K';
  if (resolution.includes('2560')) return '1440p';
  if (resolution.includes('1920')) return '1080p';
  return '720p';
};

interface RawHealth {
  id: string;
  status: HealthStatus;
  stream: StreamTransport;
  fps?: number;
  fpsTarget?: number;
  resolution?: string;
  codec?: HealthCodec;
  bitrateMbps: number;
  latencyMs?: number;
  jitterMs: number;
  packetLoss?: number;
  bufferMs: number;
  heartbeatSec: number;
  uptimePct: number;
  restarts24h: number;
  installDate: string;
  firmware: string;
  ip: string;
  edgeNode: string;
  rtspState: HealthCamera['rtsp']['state'];
  rtspTransport: 'TCP' | 'UDP';
  webrtc: HealthCamera['webrtc'];
  hls: HealthCamera['hls'];
  aiDetection: boolean;
  anprActive: boolean;
  model: string;
  modelVersion: string;
  lastInferenceMs: number;
  queueDepth: number;
  gpuUtil: number;
  issue?: string;
  issueMinutes?: number;
}

function build(raw: RawHealth): HealthCamera {
  const node = registry.get(raw.id);
  const x = node?.x ?? 800;
  const y = node?.y ?? 500;
  const geo = worldToLatLng(x, y);
  const resolution = raw.resolution ?? node?.resolution ?? '1920x1080';
  const heartbeatSec = raw.heartbeatSec;

  return {
    id: raw.id,
    location: node?.location ?? raw.id,
    area: node?.area ?? '—',
    city: node?.city ?? 'Ahmedabad',
    zone: zones[node?.area ?? ''] ?? `${node?.city ?? 'Ahmedabad'} · ${node?.area ?? 'unknown'}`,
    department: node?.department ?? 'Traffic Branch',
    status: raw.status,
    stream: raw.stream,
    fps: raw.fps ?? node?.fps ?? 0,
    fpsTarget: raw.fpsTarget ?? 25,
    resolution,
    resolutionClass: resolutionClassOf(resolution),
    codec: raw.codec ?? node?.codec ?? 'H.264',
    bitrateMbps: raw.bitrateMbps,
    latencyMs: raw.latencyMs ?? node?.latencyMs ?? 0,
    jitterMs: raw.jitterMs,
    packetLoss: raw.packetLoss ?? node?.packetLoss ?? 0,
    bufferMs: raw.bufferMs,
    lastHeartbeat: heartbeatSec <= 1 ? 'just now' : heartbeatSec < 60 ? `${heartbeatSec} s ago` : `${Math.floor(heartbeatSec / 60)}m ${heartbeatSec % 60}s ago`,
    heartbeatSec,
    uptime: node?.uptime ?? '—',
    uptimePct: raw.uptimePct,
    restarts24h: raw.restarts24h,
    installDate: raw.installDate,
    firmware: raw.firmware,
    ip: raw.ip,
    edgeNode: raw.edgeNode,
    rtsp: {
      state: raw.rtspState,
      transport: raw.rtspTransport,
      url: `rtsp://${raw.edgeNode}.gujpolice.local:554/stream/${raw.id.toLowerCase()}`,
    },
    webrtc: raw.webrtc,
    hls: raw.hls,
    ai: {
      aiDetection: raw.aiDetection,
      anprActive: raw.anprActive,
      model: raw.model,
      modelVersion: raw.modelVersion,
      lastInferenceMs: raw.lastInferenceMs,
      queueDepth: raw.queueDepth,
      gpuUtil: raw.gpuUtil,
      fpsProcessed: raw.status === 'offline' ? 0 : Math.round((raw.fps ?? node?.fps ?? 0) * 0.6),
      edgeNode: raw.edgeNode,
    },
    thumbnail: thumbnails[raw.id] ?? node?.thumbnail ?? camC001,
    x,
    y,
    lat: geo.lat,
    lng: geo.lng,
    issue: raw.issue,
    issueMinutes: raw.issueMinutes,
    streamUrl: `rtsp://${raw.edgeNode}.gujpolice.local:554/stream/${raw.id.toLowerCase()}`,
  };
}

const yolo = { model: 'yolo-v8-traffic', modelVersion: 'v8.2.1-gp' };
const anprModel = { model: 'anpr-indic-ocr', modelVersion: 'v3.4.0-gp' };

const rawCameras: RawHealth[] = [
  /* ---------------- Ahmedabad · Traffic Branch ---------------- */
  {
    id: 'C-001',
    status: 'online',
    stream: 'live',
    bitrateMbps: 6.4,
    jitterMs: 8,
    bufferMs: 240,
    heartbeatSec: 2,
    uptimePct: 99.9,
    restarts24h: 0,
    installDate: '14 Feb 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.24.11.21',
    edgeNode: 'gp-edge-01',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 142, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.4 },
    aiDetection: true,
    anprActive: true,
    ...yolo,
    lastInferenceMs: 38,
    queueDepth: 0,
    gpuUtil: 46,
  },
  {
    id: 'C-007',
    status: 'online',
    stream: 'live',
    bitrateMbps: 6.1,
    jitterMs: 11,
    bufferMs: 260,
    heartbeatSec: 1,
    uptimePct: 99.7,
    restarts24h: 0,
    installDate: '02 Jun 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.24.11.27',
    edgeNode: 'gp-edge-01',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 168, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.8 },
    aiDetection: true,
    anprActive: true,
    ...yolo,
    lastInferenceMs: 41,
    queueDepth: 1,
    gpuUtil: 52,
  },
  {
    id: 'C-045',
    status: 'online',
    stream: 'live',
    fps: 24,
    bitrateMbps: 5.2,
    jitterMs: 14,
    bufferMs: 300,
    heartbeatSec: 3,
    uptimePct: 99.2,
    restarts24h: 1,
    installDate: '19 Sep 2023',
    firmware: 'GP-EDGE 4.7.6',
    ip: '10.24.11.45',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 204, iceCandidate: 'srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 2.1 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 57,
    queueDepth: 2,
    gpuUtil: 61,
  },
  {
    id: 'C-052',
    status: 'online',
    stream: 'live',
    bitrateMbps: 5.8,
    jitterMs: 9,
    bufferMs: 250,
    heartbeatSec: 2,
    uptimePct: 99.8,
    restarts24h: 0,
    installDate: '27 Jan 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.24.11.52',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 156, iceCandidate: 'host' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.2 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 44,
    queueDepth: 0,
    gpuUtil: 49,
  },
  {
    id: 'C-089',
    status: 'poor',
    stream: 'degraded',
    fps: 18,
    fpsTarget: 25,
    resolution: '1280x720',
    latencyMs: 420,
    bitrateMbps: 2.9,
    jitterMs: 68,
    packetLoss: 1.8,
    bufferMs: 780,
    heartbeatSec: 6,
    uptimePct: 96.4,
    restarts24h: 4,
    installDate: '08 Nov 2022',
    firmware: 'GP-EDGE 4.5.9',
    ip: '10.24.12.89',
    edgeNode: 'gp-edge-03',
    rtspState: 'connected',
    rtspTransport: 'UDP',
    webrtc: { state: 'fallback', latencyMs: 468, iceCandidate: 'relay · TURN' },
    hls: { state: 'stale', segmentSec: 4, playlistLagSec: 9.2 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 132,
    queueDepth: 7,
    gpuUtil: 74,
    issue: 'Packet loss 1.8% · FPS below target',
    issueMinutes: 18,
  },
  {
    id: 'C-115',
    status: 'critical',
    stream: 'live',
    fps: 30,
    fpsTarget: 30,
    bitrateMbps: 9.8,
    jitterMs: 12,
    bufferMs: 220,
    heartbeatSec: 1,
    uptimePct: 99.9,
    restarts24h: 0,
    installDate: '03 Mar 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.24.13.15',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 134, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.1 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 268,
    queueDepth: 24,
    gpuUtil: 97,
    issue: 'ANPR OCR queue backlog · GPU thermal throttle',
    issueMinutes: 12,
  },
  {
    id: 'C-160',
    status: 'offline',
    stream: 'lost',
    fps: 0,
    latencyMs: 0,
    bitrateMbps: 0,
    jitterMs: 0,
    packetLoss: 100,
    bufferMs: 0,
    heartbeatSec: 2280,
    uptimePct: 88.1,
    restarts24h: 6,
    installDate: '21 Jul 2023',
    firmware: 'GP-EDGE 4.6.1',
    ip: '10.24.14.60',
    edgeNode: 'gp-edge-09',
    rtspState: 'timeout',
    rtspTransport: 'TCP',
    webrtc: { state: 'unavailable' },
    hls: { state: 'unavailable' },
    aiDetection: false,
    anprActive: false,
    model: '—',
    modelVersion: '—',
    lastInferenceMs: 0,
    queueDepth: 0,
    gpuUtil: 0,
    issue: 'RTSP handshake timeout · field ticket GP-FIELD-4471',
    issueMinutes: 38,
  },
  {
    id: 'C-305',
    status: 'online',
    stream: 'live',
    bitrateMbps: 8.9,
    latencyMs: 115,
    jitterMs: 6,
    bufferMs: 210,
    heartbeatSec: 7,
    uptimePct: 99.9,
    restarts24h: 0,
    installDate: '11 Apr 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.24.13.05',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 118, iceCandidate: 'host' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 0.9 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 33,
    queueDepth: 0,
    gpuUtil: 41,
  },
  {
    id: 'C-312',
    status: 'online',
    stream: 'live',
    fps: 24,
    bitrateMbps: 8.4,
    latencyMs: 406,
    jitterMs: 42,
    packetLoss: 0.6,
    bufferMs: 520,
    heartbeatSec: 2,
    uptimePct: 99.4,
    restarts24h: 1,
    installDate: '11 Apr 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.24.13.12',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 372, iceCandidate: 'srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 3.4 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 71,
    queueDepth: 3,
    gpuUtil: 66,
  },
  {
    id: 'C-316',
    status: 'online',
    stream: 'live',
    bitrateMbps: 8.7,
    latencyMs: 163,
    jitterMs: 9,
    bufferMs: 230,
    heartbeatSec: 8,
    uptimePct: 99.8,
    restarts24h: 0,
    installDate: '11 Apr 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.24.13.16',
    edgeNode: 'gp-edge-02',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 151, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.3 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 36,
    queueDepth: 0,
    gpuUtil: 44,
  },
  {
    id: 'C-346',
    status: 'online',
    stream: 'live',
    bitrateMbps: 6.0,
    latencyMs: 140,
    jitterMs: 7,
    bufferMs: 220,
    heartbeatSec: 6,
    uptimePct: 99.6,
    restarts24h: 0,
    installDate: '30 Aug 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.24.11.46',
    edgeNode: 'gp-edge-01',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 149, iceCandidate: 'host' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.5 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 47,
    queueDepth: 1,
    gpuUtil: 55,
  },
  /* ---------------- Gandhinagar ---------------- */
  {
    id: 'C-015',
    status: 'online',
    stream: 'live',
    fps: 30,
    fpsTarget: 30,
    bitrateMbps: 11.2,
    latencyMs: 140,
    jitterMs: 5,
    bufferMs: 200,
    heartbeatSec: 1,
    uptimePct: 99.9,
    restarts24h: 0,
    installDate: '22 Dec 2024',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.25.21.15',
    edgeNode: 'gp-edge-04',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 121, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 0.8 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 29,
    queueDepth: 0,
    gpuUtil: 39,
  },
  {
    id: 'C-038',
    status: 'critical',
    stream: 'live',
    fps: 30,
    fpsTarget: 30,
    bitrateMbps: 11.8,
    latencyMs: 120,
    jitterMs: 4,
    bufferMs: 190,
    heartbeatSec: 1,
    uptimePct: 99.9,
    restarts24h: 0,
    installDate: '05 Jan 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.25.21.38',
    edgeNode: 'gp-edge-04',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 108, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 0.7 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 402,
    queueDepth: 31,
    gpuUtil: 99,
    issue: 'AI inference stall · queue depth 31 frames',
    issueMinutes: 4,
  },
  {
    id: 'C-131',
    status: 'reconnecting',
    stream: 'reconnecting',
    codec: 'MJPEG',
    fps: 20,
    fpsTarget: 25,
    bitrateMbps: 3.4,
    latencyMs: 380,
    jitterMs: 96,
    packetLoss: 0.9,
    bufferMs: 1240,
    heartbeatSec: 4,
    uptimePct: 94.2,
    restarts24h: 7,
    installDate: '16 May 2022',
    firmware: 'GP-EDGE 4.4.2',
    ip: '10.25.22.31',
    edgeNode: 'gp-edge-05',
    rtspState: 'timeout',
    rtspTransport: 'UDP',
    webrtc: { state: 'fallback', latencyMs: 612, iceCandidate: 'relay · TURN' },
    hls: { state: 'stale', segmentSec: 6, playlistLagSec: 14.6 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 214,
    queueDepth: 11,
    gpuUtil: 82,
    issue: 'RTSP retry 3 of 5 · MJPEG fallback',
    issueMinutes: 5,
  },
  {
    id: 'C-399',
    status: 'online',
    stream: 'live',
    resolution: '1280x720',
    bitrateMbps: 4.1,
    latencyMs: 189,
    jitterMs: 16,
    bufferMs: 320,
    heartbeatSec: 6,
    uptimePct: 99.1,
    restarts24h: 1,
    installDate: '09 Feb 2025',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.25.22.99',
    edgeNode: 'gp-edge-05',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 176, iceCandidate: 'srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.9 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 52,
    queueDepth: 1,
    gpuUtil: 58,
  },
  {
    id: 'C-403',
    status: 'online',
    stream: 'live',
    fps: 24,
    bitrateMbps: 8.2,
    latencyMs: 307,
    jitterMs: 31,
    packetLoss: 0.4,
    bufferMs: 430,
    heartbeatSec: 1,
    uptimePct: 99.5,
    restarts24h: 0,
    installDate: '09 Feb 2025',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.25.23.03',
    edgeNode: 'gp-edge-05',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 288, iceCandidate: 'host' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 2.6 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 63,
    queueDepth: 2,
    gpuUtil: 63,
  },
  {
    id: 'C-412',
    status: 'critical',
    stream: 'degraded',
    fps: 25,
    bitrateMbps: 7.6,
    latencyMs: 367,
    jitterMs: 74,
    packetLoss: 2.4,
    bufferMs: 940,
    heartbeatSec: 6,
    uptimePct: 97.1,
    restarts24h: 3,
    installDate: '09 Feb 2025',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.25.23.12',
    edgeNode: 'gp-edge-05',
    rtspState: 'connected',
    rtspTransport: 'UDP',
    webrtc: { state: 'fallback', latencyMs: 521, iceCandidate: 'relay · TURN' },
    hls: { state: 'stale', segmentSec: 4, playlistLagSec: 11.8 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 188,
    queueDepth: 14,
    gpuUtil: 88,
    issue: 'Packet loss 2.4% · HLS playlist lag 11.8 s',
    issueMinutes: 7,
  },
  {
    id: 'C-417',
    status: 'online',
    stream: 'live',
    fps: 24,
    bitrateMbps: 8.0,
    latencyMs: 269,
    jitterMs: 22,
    bufferMs: 360,
    heartbeatSec: 6,
    uptimePct: 99.6,
    restarts24h: 0,
    installDate: '18 Mar 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.25.24.17',
    edgeNode: 'gp-edge-06',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 244, iceCandidate: 'host · srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 2.2 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 49,
    queueDepth: 0,
    gpuUtil: 47,
  },
  {
    id: 'C-429',
    status: 'poor',
    stream: 'degraded',
    fps: 25,
    bitrateMbps: 4.6,
    latencyMs: 336,
    jitterMs: 58,
    packetLoss: 1.2,
    bufferMs: 690,
    heartbeatSec: 3,
    uptimePct: 98.3,
    restarts24h: 2,
    installDate: '18 Mar 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.25.24.29',
    edgeNode: 'gp-edge-06',
    rtspState: 'connected',
    rtspTransport: 'UDP',
    webrtc: { state: 'fallback', latencyMs: 402, iceCandidate: 'relay · TURN' },
    hls: { state: 'stale', segmentSec: 4, playlistLagSec: 6.4 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 118,
    queueDepth: 5,
    gpuUtil: 71,
    issue: 'Jitter 58 ms · intermittent UDP loss',
    issueMinutes: 11,
  },
  {
    id: 'C-434',
    status: 'reconnecting',
    stream: 'reconnecting',
    fps: 18,
    fpsTarget: 25,
    bitrateMbps: 3.1,
    latencyMs: 121,
    jitterMs: 24,
    packetLoss: 0.7,
    bufferMs: 860,
    heartbeatSec: 1,
    uptimePct: 97.8,
    restarts24h: 5,
    installDate: '18 Mar 2025',
    firmware: 'GP-EDGE 4.8.4',
    ip: '10.25.24.34',
    edgeNode: 'gp-edge-06',
    rtspState: 'timeout',
    rtspTransport: 'TCP',
    webrtc: { state: 'fallback', latencyMs: 388, iceCandidate: 'relay · TURN' },
    hls: { state: 'stale', segmentSec: 4, playlistLagSec: 8.1 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 141,
    queueDepth: 6,
    gpuUtil: 69,
    issue: 'RTSP retry 2 of 5 · encoder renegotiating',
    issueMinutes: 3,
  },
  {
    id: 'C-537',
    status: 'poor',
    stream: 'degraded',
    fps: 18,
    fpsTarget: 25,
    bitrateMbps: 4.2,
    latencyMs: 274,
    jitterMs: 47,
    packetLoss: 1.1,
    bufferMs: 620,
    heartbeatSec: 4,
    uptimePct: 98.0,
    restarts24h: 2,
    installDate: '07 Jul 2024',
    firmware: 'GP-EDGE 4.7.6',
    ip: '10.25.25.37',
    edgeNode: 'gp-edge-06',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 259, iceCandidate: 'srflx' },
    hls: { state: 'serving', segmentSec: 4, playlistLagSec: 4.2 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 96,
    queueDepth: 4,
    gpuUtil: 68,
    issue: 'FPS 18 of 25 target · encoder under load',
    issueMinutes: 9,
  },
  {
    id: 'C-559',
    status: 'online',
    stream: 'live',
    fps: 24,
    bitrateMbps: 5.9,
    latencyMs: 198,
    jitterMs: 13,
    bufferMs: 280,
    heartbeatSec: 1,
    uptimePct: 99.4,
    restarts24h: 0,
    installDate: '07 Jul 2024',
    firmware: 'GP-EDGE 4.7.6',
    ip: '10.25.25.59',
    edgeNode: 'gp-edge-06',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 181, iceCandidate: 'host' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.6 },
    aiDetection: true,
    anprActive: false,
    ...yolo,
    lastInferenceMs: 55,
    queueDepth: 1,
    gpuUtil: 51,
  },
  /* ---------------- Vadodara ---------------- */
  {
    id: 'C-207',
    status: 'online',
    stream: 'live',
    bitrateMbps: 6.3,
    latencyMs: 205,
    jitterMs: 12,
    bufferMs: 290,
    heartbeatSec: 2,
    uptimePct: 99.5,
    restarts24h: 0,
    installDate: '29 Oct 2024',
    firmware: 'GP-EDGE 4.8.2',
    ip: '10.31.41.07',
    edgeNode: 'gp-edge-09',
    rtspState: 'connected',
    rtspTransport: 'TCP',
    webrtc: { state: 'active', latencyMs: 192, iceCandidate: 'srflx' },
    hls: { state: 'serving', segmentSec: 2, playlistLagSec: 1.7 },
    aiDetection: true,
    anprActive: true,
    ...anprModel,
    lastInferenceMs: 43,
    queueDepth: 0,
    gpuUtil: 48,
  },
];

export const healthCameras: HealthCamera[] = rawCameras.map(build);

export const healthCameraById = new Map(healthCameras.map((camera) => [camera.id, camera]));

/* ------------------------------------------------------------------ *
 * Filter / sort (pure)
 * ------------------------------------------------------------------ */

export const defaultHealthFilters: HealthFilters = {
  status: 'all',
  department: 'all',
  city: 'all',
  codec: 'all',
  resolution: 'all',
  query: '',
};

export function filterCameras(cameras: HealthCamera[], filters: HealthFilters): HealthCamera[] {
  const q = filters.query.trim().toLowerCase();
  return cameras.filter((camera) => {
    if (filters.status !== 'all' && camera.status !== filters.status) return false;
    if (filters.department !== 'all' && camera.department !== filters.department) return false;
    if (filters.city !== 'all' && camera.city !== filters.city) return false;
    if (filters.codec !== 'all' && camera.codec !== filters.codec) return false;
    if (filters.resolution !== 'all' && camera.resolutionClass !== filters.resolution) return false;
    if (!q) return true;
    return (
      camera.id.toLowerCase().includes(q) ||
      camera.location.toLowerCase().includes(q) ||
      camera.area.toLowerCase().includes(q) ||
      camera.city.toLowerCase().includes(q) ||
      camera.zone.toLowerCase().includes(q) ||
      camera.ip.includes(q)
    );
  });
}

const collator = new Intl.Collator('en', { numeric: true });
const statusRank: Record<HealthStatus, number> = { critical: 0, offline: 1, reconnecting: 2, poor: 3, online: 4 };

export function sortCameras(cameras: HealthCamera[], key: HealthSortKey, dir: SortDir, settings: HealthSettings): HealthCamera[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...cameras].sort((a, b) => {
    switch (key) {
      case 'camera':
        return collator.compare(a.id, b.id) * factor;
      case 'location':
        return collator.compare(a.location, b.location) * factor;
      case 'department':
        return collator.compare(a.department, b.department) * factor || collator.compare(a.id, b.id);
      case 'status':
        return (statusRank[a.status] - statusRank[b.status]) * factor || collator.compare(a.id, b.id);
      case 'fps':
        return (a.fps - b.fps) * factor || collator.compare(a.id, b.id);
      case 'latency':
        return (a.latencyMs - b.latencyMs) * factor || collator.compare(a.id, b.id);
      case 'bitrate':
        return (a.bitrateMbps - b.bitrateMbps) * factor || collator.compare(a.id, b.id);
      case 'heartbeat':
        return (a.heartbeatSec - b.heartbeatSec) * factor || collator.compare(a.id, b.id);
      default:
        return (evaluateCamera(a, settings).score - evaluateCamera(b, settings).score) * factor || collator.compare(a.id, b.id);
    }
  });
}

export const sortOptions: Array<{ id: HealthSortKey; label: string }> = [
  { id: 'status', label: 'Status (worst first)' },
  { id: 'health', label: 'Health score' },
  { id: 'camera', label: 'Camera ID' },
  { id: 'location', label: 'Location' },
  { id: 'department', label: 'Department' },
  { id: 'latency', label: 'Latency' },
  { id: 'fps', label: 'FPS' },
  { id: 'bitrate', label: 'Bitrate' },
  { id: 'heartbeat', label: 'Last heartbeat' },
];

export function departmentOptions(cameras: HealthCamera[]): string[] {
  return [...new Set(cameras.map((camera) => camera.department))].sort(collator.compare);
}

export function cityOptions(cameras: HealthCamera[]): string[] {
  return [...new Set(cameras.map((camera) => camera.city))].sort(collator.compare);
}

export function codecOptions(cameras: HealthCamera[]): string[] {
  return [...new Set(cameras.map((camera) => camera.codec))].sort(collator.compare);
}

export function resolutionOptions(cameras: HealthCamera[]): string[] {
  return [...new Set(cameras.map((camera) => camera.resolutionClass))].sort(collator.compare);
}

/* ------------------------------------------------------------------ *
 * Evaluation against thresholds (drives tones, score and attention list)
 * ------------------------------------------------------------------ */

export function evaluateCamera(camera: HealthCamera, settings: HealthSettings): HealthEvaluation {
  const reasons: string[] = [];
  let score = 100;

  const fpsRatio = camera.fpsTarget > 0 ? camera.fps / camera.fpsTarget : 1;
  const fpsTone: MetricTone =
    camera.fps === 0 ? 'red' : fpsRatio * 100 >= settings.fpsMinPct ? 'green' : fpsRatio * 100 >= settings.fpsMinPct - 15 ? 'amber' : 'red';
  if (camera.fps === 0) {
    score -= 45;
    reasons.push('No video frames received');
  } else if (fpsTone !== 'green') {
    score -= fpsTone === 'red' ? 18 : 9;
    reasons.push(`FPS ${camera.fps} of ${camera.fpsTarget} target`);
  }

  const latencyTone: MetricTone =
    camera.latencyMs >= settings.latencyCritMs ? 'red' : camera.latencyMs >= settings.latencyWarnMs ? 'amber' : 'green';
  if (latencyTone === 'red') {
    score -= 16;
    reasons.push(`Latency ${camera.latencyMs} ms over critical ${settings.latencyCritMs} ms`);
  } else if (latencyTone === 'amber') {
    score -= 8;
    reasons.push(`Latency ${camera.latencyMs} ms over warning ${settings.latencyWarnMs} ms`);
  }

  const lossTone: MetricTone =
    camera.packetLoss >= settings.lossCritPct ? 'red' : camera.packetLoss >= settings.lossWarnPct ? 'amber' : 'green';
  if (lossTone === 'red') {
    score -= 18;
    reasons.push(`Packet loss ${camera.packetLoss.toFixed(1)}%`);
  } else if (lossTone === 'amber') {
    score -= 9;
    reasons.push(`Packet loss ${camera.packetLoss.toFixed(1)}%`);
  }

  const heartbeatTone: MetricTone =
    camera.heartbeatSec >= 600 ? 'red' : camera.heartbeatSec >= settings.heartbeatWarnSec ? 'amber' : 'green';
  if (heartbeatTone === 'red') {
    score -= 22;
    reasons.push(`Heartbeat stale for ${camera.lastHeartbeat.replace(' ago', '')}`);
  } else if (heartbeatTone === 'amber') {
    score -= 6;
    reasons.push(`Heartbeat every ${camera.heartbeatSec} s`);
  }

  if (camera.status === 'critical') {
    score -= 20;
    if (camera.ai.queueDepth > 10) reasons.push(`AI queue depth ${camera.ai.queueDepth} frames`);
  }
  if (camera.status === 'offline') score -= 30;
  if (camera.status === 'reconnecting') {
    score -= 14;
    reasons.push('Stream re-negotiating');
  }
  if (camera.status === 'poor') score -= 10;
  if (camera.restarts24h >= 4) {
    score -= 6;
    reasons.push(`${camera.restarts24h} stream restarts in 24 h`);
  }
  if (camera.hls.state === 'stale') {
    score -= 5;
    reasons.push(`HLS playlist lag ${camera.hls.playlistLagSec?.toFixed(1)} s`);
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  // Status wins over the score: an operator-flagged camera never renders green.
  const tone: MetricTone =
    camera.status === 'critical' || camera.status === 'offline'
      ? 'red'
      : camera.status === 'reconnecting'
        ? 'cyan'
        : clamped < 55
          ? 'red'
          : clamped < 78
            ? 'amber'
            : 'green';

  return {
    score: clamped,
    tone,
    fpsTone,
    latencyTone,
    lossTone,
    heartbeatTone,
    attention: camera.status !== 'online' || clamped < 78,
    reasons: reasons.length ? reasons : ['All subsystems nominal'],
  };
}

/* ------------------------------------------------------------------ *
 * Status distribution + location health
 * ------------------------------------------------------------------ */

export function statusSlices(fleet: FleetHealth): StatusSlice[] {
  const pct = (value: number) => Number(((value / fleet.total) * 100).toFixed(1));
  // Largest-remainder split (shared helper) so the three primary buckets total exactly 100%.
  const [onlineWhole, offlineWhole, poorWhole] = distribute(100, [fleet.online, fleet.offline, fleet.poor]);
  return [
    { id: 'online', label: 'Online', count: fleet.online, percent: pct(fleet.online), whole: onlineWhole, color: statusMeta.online.color },
    { id: 'offline', label: 'Offline', count: fleet.offline, percent: pct(fleet.offline), whole: offlineWhole, color: statusMeta.offline.color },
    { id: 'poor', label: 'Poor Signal', count: fleet.poor, percent: pct(fleet.poor), whole: poorWhole, color: statusMeta.poor.color },
    {
      id: 'reconnecting',
      label: 'Reconnecting',
      count: fleet.reconnecting,
      percent: pct(fleet.reconnecting),
      whole: pct(fleet.reconnecting),
      color: statusMeta.reconnecting.color,
      subsetOf: 'Poor Signal',
    },
    {
      id: 'critical',
      label: 'Critical',
      count: fleet.critical,
      percent: pct(fleet.critical),
      whole: pct(fleet.critical),
      color: statusMeta.critical.color,
      subsetOf: 'Offline / Poor Signal',
    },
  ];
}

export function statusCounts(cameras: HealthCamera[]): Record<'all' | HealthStatus, number> {
  const counts: Record<'all' | HealthStatus, number> = {
    all: cameras.length,
    online: 0,
    offline: 0,
    poor: 0,
    reconnecting: 0,
    critical: 0,
  };
  cameras.forEach((camera) => {
    counts[camera.status] += 1;
  });
  return counts;
}

export function locationHealth(cameras: HealthCamera[], settings: HealthSettings): LocationHealthRow[] {
  const groups = new Map<string, HealthCamera[]>();
  cameras.forEach((camera) => {
    const key = `${camera.area}|${camera.city}`;
    const list = groups.get(key) ?? [];
    list.push(camera);
    groups.set(key, list);
  });

  return [...groups.entries()]
    .map(([key, list]) => {
      const [area, city] = key.split('|');
      const scores = list.map((camera) => evaluateCamera(camera, settings).score);
      const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
      const worst = list.reduce(
        (acc, camera) => (evaluateCamera(camera, settings).score < evaluateCamera(acc, settings).score ? camera : acc),
        list[0],
      );
      return {
        id: key,
        label: area,
        city,
        cameras: list.length,
        online: list.filter((camera) => camera.status === 'online').length,
        degraded: list.filter((camera) => camera.status === 'poor' || camera.status === 'reconnecting').length,
        down: list.filter((camera) => camera.status === 'offline' || camera.status === 'critical').length,
        score,
        worst: `${worst.id} · ${worst.status}`,
      };
    })
    .sort((a, b) => a.score - b.score || b.cameras - a.cameras);
}

export function criticalCameras(cameras: HealthCamera[], settings: HealthSettings): CriticalCamera[] {
  return cameras
    .filter((camera) => camera.status !== 'online')
    .map((camera) => {
      const evaluation = evaluateCamera(camera, settings);
      const action: CriticalCamera['action'] =
        camera.status === 'offline' || camera.status === 'reconnecting'
          ? 'Restart Stream'
          : camera.ai.anprActive && camera.ai.queueDepth > 10
            ? 'Re-pair ANPR'
            : 'Escalate';
      return {
        cameraId: camera.id,
        location: camera.location,
        city: camera.city,
        issue: camera.issue ?? statusMeta[camera.status].label,
        detail: evaluation.reasons.slice(0, 2).join(' · '),
        durationLabel: camera.issueMinutes
          ? camera.issueMinutes >= 60
            ? `${(camera.issueMinutes / 60).toFixed(1)} hr`
            : `${camera.issueMinutes} min`
          : 'just now',
        durationMin: camera.issueMinutes ?? 0,
        tone: (camera.status === 'critical' || camera.status === 'offline' ? 'red' : camera.status === 'reconnecting' ? 'cyan' : 'amber') as MetricTone,
        action,
        camera,
      };
    })
    .sort((a, b) => b.durationMin - a.durationMin);
}

/* ------------------------------------------------------------------ *
 * Stream quality series (2 h of 5-minute buckets ending at the reference clock)
 * ------------------------------------------------------------------ */

const SERIES_POINTS = 24;
const SERIES_STEP = 300;

function seriesLabels(): string[] {
  const start = Math.floor((BASE - (SERIES_POINTS - 1) * SERIES_STEP) / SERIES_STEP) * SERIES_STEP;
  return Array.from({ length: SERIES_POINTS }, (_, i) => clockOf(start + i * SERIES_STEP).slice(0, 5));
}

const labels = seriesLabels();

function points(values: number[]): QualityPoint[] {
  return values.map((value, index) => ({ label: labels[index], value }));
}

export const streamQualitySeries: StreamQualitySeries = {
  fps: points([
    24.9, 25.0, 24.8, 24.6, 24.7, 24.5, 24.4, 23.9, 21.8, 22.4, 23.6, 24.2, 24.5, 24.6, 24.4, 24.3, 24.6, 24.7, 24.5, 24.2,
    23.8, 24.1, 24.4, 24.6,
  ]),
  latency: points([
    172, 168, 175, 181, 179, 186, 192, 214, 268, 246, 224, 208, 196, 189, 184, 178, 176, 182, 196, 228, 262, 340, 244, 186,
  ]),
  bitrate: points([
    47.2, 47.8, 48.1, 48.6, 48.2, 47.9, 47.4, 46.1, 43.2, 44.0, 45.8, 47.1, 48.0, 48.4, 48.1, 47.6, 47.9, 48.3, 48.0, 47.2,
    46.4, 45.1, 47.0, 48.9,
  ]),
  loss: points([
    0.3, 0.4, 0.3, 0.5, 0.4, 0.6, 0.7, 0.9, 1.6, 1.4, 1.0, 0.8, 0.6, 0.5, 0.4, 0.5, 0.6, 0.7, 0.9, 1.2, 1.5, 2.1, 1.1, 0.6,
  ]),
};

/** Aggregate readouts above the quality charts, derived from the same series. */
export function streamQualitySummary(series: StreamQualitySeries) {
  const last = (list: QualityPoint[]) => list[list.length - 1].value;
  const avg = (list: QualityPoint[]) => list.reduce((sum, point) => sum + point.value, 0) / list.length;
  const extreme = (list: QualityPoint[], dir: 1 | -1) =>
    list.reduce((best, point) => (dir * point.value > dir * best.value ? point : best), list[0]);
  return {
    fps: {
      value: Number(last(series.fps).toFixed(1)),
      avg: Number(avg(series.fps).toFixed(1)),
      low: extreme(series.fps, -1),
      peak: extreme(series.fps, 1),
    },
    latency: { value: Math.round(last(series.latency)), avg: Math.round(avg(series.latency)), peak: extreme(series.latency, 1) },
    bitrate: { value: Number(last(series.bitrate).toFixed(1)), avg: Number(avg(series.bitrate).toFixed(1)), peak: extreme(series.bitrate, 1) },
    loss: { value: Number(last(series.loss).toFixed(2)), avg: Number(avg(series.loss).toFixed(2)), peak: extreme(series.loss, 1) },
  };
}

export const qualityWindowLabel = `${labels[0]}–${labels[labels.length - 1]} · 5 min buckets`;

/* ------------------------------------------------------------------ *
 * Recent health events
 * ------------------------------------------------------------------ */

interface RawEvent extends Omit<HealthEvent, 'time' | 'icon'> {
  icon?: HealthEvent['icon'];
}

const rawEvents: RawEvent[] = [
  {
    id: 'HE-4471',
    kind: 'disconnected',
    cameraId: 'C-160',
    location: 'Aslali Toll Plaza',
    city: 'Ahmedabad',
    seconds: t(10, 8, 12),
    detail: 'RTSP handshake timeout after 5 retries · edge gp-edge-09 unreachable · field ticket GP-FIELD-4471 raised',
    tone: 'red',
  },
  {
    id: 'HE-4468',
    kind: 'processing',
    cameraId: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    seconds: t(10, 42, 6),
    detail: 'AI inference stall on gp-edge-04 · queue depth 31 frames · watchdog scheduled a pipeline restart',
    tone: 'red',
  },
  {
    id: 'HE-4466',
    kind: 'poor-signal',
    cameraId: 'C-412',
    location: 'NH-147 · Node 5',
    city: 'Gandhinagar',
    seconds: t(10, 39, 24),
    detail: 'Packet loss crossed 2.0% for 90 s · WebRTC fell back to TURN relay · HLS playlist lag 11.8 s',
    tone: 'amber',
  },
  {
    id: 'HE-4463',
    kind: 'reconnecting',
    cameraId: 'C-131',
    location: 'Dahegam Highway',
    city: 'Gandhinagar',
    seconds: t(10, 41, 3),
    detail: 'RTSP retry 3 of 5 · MJPEG fallback engaged while H.264 encoder renegotiates',
    tone: 'cyan',
  },
  {
    id: 'HE-4461',
    kind: 'processing',
    cameraId: 'C-115',
    location: 'S.G. Highway',
    city: 'Ahmedabad',
    seconds: t(10, 34, 41),
    detail: 'ANPR OCR queue backlog 24 frames · GPU thermal throttle at 97% · model anpr-indic-ocr v3.4.0-gp',
    tone: 'red',
  },
  {
    id: 'HE-4458',
    kind: 'poor-signal',
    cameraId: 'C-089',
    location: 'Maninagar Junction',
    city: 'Ahmedabad',
    seconds: t(10, 28, 17),
    detail: 'FPS dropped to 18 of 25 target · jitter 68 ms · upstream microwave link degraded',
    tone: 'amber',
  },
  {
    id: 'HE-4455',
    kind: 'codec',
    cameraId: 'C-434',
    location: 'Sector Road · Node 4',
    city: 'Gandhinagar',
    seconds: t(10, 43, 9),
    detail: 'Codec renegotiation H.264 → H.264 (baseline) after decoder reset · keyframe interval 2 s',
    tone: 'cyan',
  },
  {
    id: 'HE-4452',
    kind: 'recovered',
    cameraId: 'C-052',
    location: 'Vastrapur Lake Road',
    city: 'Ahmedabad',
    seconds: t(10, 22, 38),
    detail: 'Stream recovered after 41 s · RTSP re-established over TCP · auto-restart policy applied',
    tone: 'green',
    autoResolved: true,
  },
  {
    id: 'HE-4449',
    kind: 'poor-signal',
    cameraId: 'C-429',
    location: 'Sector Road · Node 3',
    city: 'Gandhinagar',
    seconds: t(10, 35, 2),
    detail: 'Jitter 58 ms with intermittent UDP loss · ingest buffer grew to 690 ms',
    tone: 'amber',
  },
  {
    id: 'HE-4446',
    kind: 'reconnecting',
    cameraId: 'C-537',
    location: 'Dahegam Road · Node 1',
    city: 'Gandhinagar',
    seconds: t(10, 19, 44),
    detail: 'RTSP session dropped · reconnect attempt 1 of 5 succeeded in 6 s',
    tone: 'cyan',
    autoResolved: true,
  },
  {
    id: 'HE-4443',
    kind: 'codec',
    cameraId: 'C-305',
    location: 'S.G. Highway · Node 1',
    city: 'Ahmedabad',
    seconds: t(10, 14, 51),
    detail: 'Firmware GP-EDGE 4.8.4 rollout completed · H.265 profile high-10 applied · no downtime',
    tone: 'cyan',
    autoResolved: true,
  },
  {
    id: 'HE-4440',
    kind: 'recovered',
    cameraId: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    seconds: t(10, 11, 8),
    detail: 'Latency spike 612 ms cleared after edge gp-edge-04 failover · back to 140 ms',
    tone: 'green',
    autoResolved: true,
  },
  {
    id: 'HE-4437',
    kind: 'processing',
    cameraId: 'C-045',
    location: 'Iskcon Circle',
    city: 'Ahmedabad',
    seconds: t(10, 6, 33),
    detail: 'ANPR disabled on this feed (model swap to yolo-v8-traffic v8.2.1-gp) · AI detection nominal',
    tone: 'cyan',
  },
  {
    id: 'HE-4434',
    kind: 'disconnected',
    cameraId: 'C-207',
    location: 'Vadodara City Center',
    city: 'Vadodara',
    seconds: t(9, 58, 26),
    detail: 'Brief RTSP drop on gp-edge-09 · reconnected in 12 s · no evidence gap recorded',
    tone: 'amber',
    autoResolved: true,
  },
];

const eventIcons: Record<HealthEvent['kind'], HealthEvent['icon']> = {
  disconnected: WifiOff,
  reconnecting: RotateCw,
  'poor-signal': Signal,
  recovered: PlugZap,
  codec: Radio,
  processing: Cpu,
};

export const healthEvents: HealthEvent[] = rawEvents
  .map((event) => ({ ...event, time: clockOf(event.seconds), icon: event.icon ?? eventIcons[event.kind] }))
  .sort((a, b) => b.seconds - a.seconds);

export const eventKindMeta: Record<HealthEvent['kind'], { label: string; icon: HealthEvent['icon'] }> = {
  disconnected: { label: 'Disconnected', icon: WifiOff },
  reconnecting: { label: 'Reconnecting', icon: RotateCw },
  'poor-signal': { label: 'Poor signal', icon: Signal },
  recovered: { label: 'Stream recovered', icon: PlugZap },
  codec: { label: 'Codec change', icon: Radio },
  processing: { label: 'AI / ANPR processing', icon: Cpu },
};

/* ------------------------------------------------------------------ *
 * Console-level aggregates
 * ------------------------------------------------------------------ */

export function fleetReadout(cameras: HealthCamera[], settings: HealthSettings) {
  const scores = cameras.map((camera) => evaluateCamera(camera, settings).score);
  const online = cameras.filter((camera) => camera.status === 'online');
  const avgLatency = online.length
    ? Math.round(online.reduce((sum, camera) => sum + camera.latencyMs, 0) / online.length)
    : 0;
  const avgFps = online.length ? Number((online.reduce((sum, camera) => sum + camera.fps, 0) / online.length).toFixed(1)) : 0;
  const ingest = Number(cameras.reduce((sum, camera) => sum + camera.bitrateMbps, 0).toFixed(1));
  const anprActive = cameras.filter((camera) => camera.ai.anprActive).length;
  const aiActive = cameras.filter((camera) => camera.ai.aiDetection).length;
  return {
    monitored: cameras.length,
    meanScore: Math.round(scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length)),
    avgLatency,
    avgFps,
    ingest,
    anprActive,
    aiActive,
    attention: cameras.filter((camera) => evaluateCamera(camera, settings).attention).length,
    restarts24h: cameras.reduce((sum, camera) => sum + camera.restarts24h, 0),
  };
}

/** CSV manifest used by the Export Report control. */
export function healthReportCsv(cameras: HealthCamera[], settings: HealthSettings): string {
  const header = [
    'camera_id',
    'location',
    'area',
    'city',
    'zone',
    'department',
    'status',
    'stream',
    'health_score',
    'fps',
    'fps_target',
    'resolution',
    'codec',
    'bitrate_mbps',
    'latency_ms',
    'jitter_ms',
    'packet_loss_pct',
    'buffer_ms',
    'last_heartbeat',
    'uptime_pct',
    'restarts_24h',
    'rtsp_state',
    'webrtc_state',
    'hls_state',
    'ai_detection',
    'anpr_active',
    'ai_model',
    'queue_depth',
    'gpu_util_pct',
    'ip',
    'edge_node',
    'lat',
    'lng',
  ];
  const rows = cameras.map((camera) => {
    const evaluation = evaluateCamera(camera, settings);
    return [
      camera.id,
      camera.location,
      camera.area,
      camera.city,
      camera.zone,
      camera.department,
      camera.status,
      camera.stream,
      evaluation.score,
      camera.fps,
      camera.fpsTarget,
      camera.resolution,
      camera.codec,
      camera.bitrateMbps.toFixed(1),
      camera.latencyMs,
      camera.jitterMs,
      camera.packetLoss.toFixed(1),
      camera.bufferMs,
      camera.lastHeartbeat,
      camera.uptimePct.toFixed(1),
      camera.restarts24h,
      camera.rtsp.state,
      camera.webrtc.state,
      camera.hls.state,
      camera.ai.aiDetection ? 'yes' : 'no',
      camera.ai.anprActive ? 'yes' : 'no',
      camera.ai.model,
      camera.ai.queueDepth,
      camera.ai.gpuUtil,
      camera.ip,
      camera.edgeNode,
      camera.lat.toFixed(5),
      camera.lng.toFixed(5),
    ]
      .map((cell) => (String(cell).includes(',') ? `"${cell}"` : String(cell)))
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

/* ------------------------------------------------------------------ *
 * Live telemetry drift. Feed the page's tick in (0 = paused) and every
 * readout breathes like a real ingest stream. When the WebSocket health
 * channel lands (`services/realtime.ts` -> `camera:health`), this function
 * is simply replaced by the frames it pushes.
 * ------------------------------------------------------------------ */

export function liveCamera(camera: HealthCamera, tick: number): HealthCamera {
  if (tick === 0 || camera.status === 'offline') return camera;
  const seed = camera.id;
  const fps = camera.fps === 0 ? 0 : Math.max(0, drift(camera.fps, Math.max(0.4, camera.fps * 0.04), `${seed}:fps`, tick, 1));
  const latencyMs = Math.max(0, Math.round(drift(camera.latencyMs, Math.max(6, camera.latencyMs * 0.07), `${seed}:lat`, tick, 0)));
  const bitrateMbps = Number(drift(camera.bitrateMbps, Math.max(0.12, camera.bitrateMbps * 0.035), `${seed}:br`, tick, 2).toFixed(2));
  const packetLoss = Number(Math.max(0, drift(camera.packetLoss, 0.12, `${seed}:loss`, tick, 2)).toFixed(2));
  const jitterMs = Math.max(0, Math.round(drift(camera.jitterMs, Math.max(1.5, camera.jitterMs * 0.08), `${seed}:jit`, tick, 0)));
  const bufferMs = Math.max(0, Math.round(drift(camera.bufferMs, Math.max(12, camera.bufferMs * 0.08), `${seed}:buf`, tick, 0)));
  const queueDepth = Math.max(0, Math.round(drift(camera.ai.queueDepth, Math.max(1, camera.ai.queueDepth * 0.25), `${seed}:q`, tick, 0)));
  const gpuUtil = Math.max(0, Math.min(100, Math.round(drift(camera.ai.gpuUtil, 4, `${seed}:gpu`, tick, 0))));
  const lastInferenceMs = Math.max(1, Math.round(drift(camera.ai.lastInferenceMs, Math.max(4, camera.ai.lastInferenceMs * 0.12), `${seed}:inf`, tick, 0)));

  return {
    ...camera,
    fps,
    latencyMs,
    bitrateMbps,
    packetLoss,
    jitterMs,
    bufferMs,
    ai: { ...camera.ai, queueDepth, gpuUtil, lastInferenceMs, fpsProcessed: Math.round(fps * 0.6) },
  };
}
