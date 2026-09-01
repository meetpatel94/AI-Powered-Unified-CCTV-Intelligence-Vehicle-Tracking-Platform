import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** Operational state shown in the health console. */
export type HealthStatus = 'online' | 'offline' | 'poor' | 'reconnecting' | 'critical';

/** Transport-level state of the ingest pipeline. */
export type StreamTransport = 'live' | 'degraded' | 'reconnecting' | 'lost';

export type HealthCodec = 'H.264' | 'H.265' | 'MJPEG';

export type ResolutionClass = '720p' | '1080p' | '1440p' | '4K';

export type HealthSortKey =
  | 'camera'
  | 'location'
  | 'department'
  | 'status'
  | 'fps'
  | 'latency'
  | 'bitrate'
  | 'heartbeat'
  | 'health';

export type SortDir = 'asc' | 'desc';

export type MetricTone = 'green' | 'amber' | 'red' | 'cyan';

export type HealthEventKind =
  | 'disconnected'
  | 'reconnecting'
  | 'poor-signal'
  | 'recovered'
  | 'codec'
  | 'processing';

/* ------------------------------------------------------------------ *
 * Stream / AI subsystems
 * ------------------------------------------------------------------ */

export interface RtspEndpoint {
  state: 'connected' | 'timeout' | 'failed';
  url: string;
  transport: 'TCP' | 'UDP';
}

export interface WebRtcEndpoint {
  state: 'active' | 'fallback' | 'unavailable';
  latencyMs?: number;
  iceCandidate?: string;
}

export interface HlsEndpoint {
  state: 'serving' | 'stale' | 'unavailable';
  segmentSec?: number;
  playlistLagSec?: number;
}

export interface AiPipeline {
  aiDetection: boolean;
  anprActive: boolean;
  model: string;
  modelVersion: string;
  lastInferenceMs: number;
  queueDepth: number;
  gpuUtil: number;
  fpsProcessed: number;
  edgeNode: string;
}

/* ------------------------------------------------------------------ *
 * Camera record
 * ------------------------------------------------------------------ */

export interface HealthCamera {
  id: string;
  location: string;
  area: string;
  city: string;
  zone: string;
  department: string;
  status: HealthStatus;
  stream: StreamTransport;
  fps: number;
  fpsTarget: number;
  resolution: string;
  resolutionClass: ResolutionClass;
  codec: HealthCodec;
  bitrateMbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLoss: number;
  bufferMs: number;
  lastHeartbeat: string;
  heartbeatSec: number;
  uptime: string;
  uptimePct: number;
  restarts24h: number;
  installDate: string;
  firmware: string;
  ip: string;
  edgeNode: string;
  rtsp: RtspEndpoint;
  webrtc: WebRtcEndpoint;
  hls: HlsEndpoint;
  ai: AiPipeline;
  thumbnail: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  /** Populated when the camera needs operator attention. */
  issue?: string;
  issueMinutes?: number;
  /** Placeholder for the future RTSP → HLS/WHEP gateway (`services/streams.ts`). */
  streamUrl: string;
}

/* ------------------------------------------------------------------ *
 * Thresholds (drive evaluation + the Settings modal)
 * ------------------------------------------------------------------ */

export interface HealthSettings {
  latencyWarnMs: number;
  latencyCritMs: number;
  lossWarnPct: number;
  lossCritPct: number;
  fpsMinPct: number;
  heartbeatWarnSec: number;
  refreshSec: number;
  autoRestart: boolean;
  notifyCritical: boolean;
  anprAlerts: boolean;
}

/** Result of scoring one camera against the current thresholds. */
export interface HealthEvaluation {
  score: number;
  tone: MetricTone;
  fpsTone: MetricTone;
  latencyTone: MetricTone;
  lossTone: MetricTone;
  heartbeatTone: MetricTone;
  attention: boolean;
  reasons: string[];
}

/* ------------------------------------------------------------------ *
 * Filters + analytics
 * ------------------------------------------------------------------ */

export interface HealthFilters {
  status: 'all' | HealthStatus;
  department: string;
  city: string;
  codec: string;
  resolution: string;
  query: string;
}

export interface QualityPoint {
  label: string;
  value: number;
}

export interface StreamQualitySeries {
  fps: QualityPoint[];
  latency: QualityPoint[];
  bitrate: QualityPoint[];
  loss: QualityPoint[];
}

export interface StatusSlice {
  id: HealthStatus | 'reconnecting';
  label: string;
  count: number;
  percent: number;
  /** Integer share of the fleet; largest-remainder rounded so the three
   *  primary buckets always total exactly 100%. */
  whole: number;
  color: string;
  /** True when the bucket is a live sub-state of another bucket. */
  subsetOf?: string;
}

export interface LocationHealthRow {
  id: string;
  label: string;
  city: string;
  cameras: number;
  online: number;
  degraded: number;
  down: number;
  score: number;
  worst: string;
}

export interface HealthEvent {
  id: string;
  kind: HealthEventKind;
  cameraId: string;
  location: string;
  city: string;
  seconds: number;
  time: string;
  detail: string;
  tone: MetricTone;
  icon: LucideIcon;
  autoResolved?: boolean;
}

export interface CriticalCamera {
  cameraId: string;
  location: string;
  city: string;
  issue: string;
  detail: string;
  durationLabel: string;
  durationMin: number;
  tone: MetricTone;
  action: 'Restart Stream' | 'Escalate' | 'Re-pair ANPR';
  camera: HealthCamera;
}

export interface FleetHealth {
  total: number;
  online: number;
  offline: number;
  poor: number;
  /** Live sub-state of the poor-signal bucket. */
  reconnecting: number;
  /** Live sub-state of offline + poor (needs operator action). */
  critical: number;
  avgLatencyMs: number;
  avgFps: number;
  ingestMbps: number;
  anprReadsToday: number;
}
