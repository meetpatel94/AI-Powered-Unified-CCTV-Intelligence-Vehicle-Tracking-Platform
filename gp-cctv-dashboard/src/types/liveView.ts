export type CameraStatus = 'online' | 'offline' | 'reconnecting' | 'warning' | 'critical';
export type StreamQuality = 'SD' | 'HD' | 'FHD' | '4K';
export type Codec = 'H.264' | 'H.265' | 'MJPEG';
export type CameraFilterId = 'all' | 'online' | 'offline' | 'critical' | 'anpr' | 'ai';
export type EventTone = 'info' | 'warning' | 'critical';

export interface DetectionBox {
  /** Percentages relative to the frame, so overlays scale with any tile size. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: 'vehicle' | 'bike' | 'person' | 'crowd' | 'anpr';
  confidence?: number;
}

export interface CameraEvent {
  time: string;
  text: string;
  tone: EventTone;
}

export interface LiveCamera {
  id: string;
  location: string;
  city: string;
  zone: string;
  department: string;
  thumbnail: string;
  status: CameraStatus;
  quality: StreamQuality;
  fps: number;
  resolution: string;
  codec: Codec;
  bitrateMbps: number;
  latencyMs: number;
  packetLoss: number;
  uptime: string;
  lastHeartbeat: string;
  anprActive: boolean;
  aiDetection: boolean;
  detections: DetectionBox[];
  vehicleCount: number;
  lastPlate?: string;
  alertLabel?: string;
  /** Catalogue RTSP URL (never hard-coded). */
  streamUrl: string;
  /** Latest JPEG from the stream gateway; polled by Live View. */
  liveFrameUrl?: string;
  gatewayState?: string;
  events: CameraEvent[];
}

export interface AnprHit {
  id: string;
  plate: string;
  camera: string;
  time: string;
  confidence: number;
  watchlist?: boolean;
}

export interface StreamHealthMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: 'green' | 'amber' | 'red' | 'blue';
  pct: number;
}
