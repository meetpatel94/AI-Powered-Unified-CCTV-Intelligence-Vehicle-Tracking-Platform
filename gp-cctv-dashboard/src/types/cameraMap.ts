export type MapCameraStatus = 'online' | 'warning' | 'critical' | 'offline';
export type MapCodec = 'H.264' | 'H.265' | 'MJPEG';

export interface CameraEventRow {
  time: string;
  text: string;
  tone: 'info' | 'warning' | 'critical';
}

export interface MapCameraNode {
  id: string;
  /** World coordinates (see gisGeometry). Swap for lat/lng when GIS lands. */
  x: number;
  y: number;
  location: string;
  area: string;
  city: string;
  department: string;
  status: MapCameraStatus;
  codec: MapCodec;
  resolution: string;
  fps: number;
  latencyMs: number;
  packetLoss: number;
  lastHeartbeat: string;
  uptime: string;
  vehiclesDetected: number;
  lastPlate?: string;
  anpr: boolean;
  ai: boolean;
  thumbnail?: string;
  alertLabel?: string;
  events: CameraEventRow[];
}

export interface JourneyNode {
  step: number;
  cameraId: string;
  road: string;
  city: string;
  time: string;
  x: number;
  y: number;
  critical?: boolean;
  thumbnail: string;
  speed: string;
  direction: string;
}

export interface TrackedVehicleRoute {
  plate: string;
  type: string;
  color: string;
  watchlist: boolean;
  /** World-space waypoints per leg, so the polyline can follow the road grid. */
  legs: Array<{ points: Array<[number, number]>; critical?: boolean }>;
  nodes: JourneyNode[];
}

export interface MapLayerState {
  cameras: boolean;
  clusters: boolean;
  alerts: boolean;
  route: boolean;
  labels: boolean;
  heat: boolean;
}

export interface CameraMapFilters {
  status: 'all' | MapCameraStatus;
  departments: string[];
  codecs: MapCodec[];
  anprOnly: boolean;
  aiOnly: boolean;
  query: string;
}
