/**
 * REST client stubs.
 *
 * The dashboard currently renders from `src/data/mockData.ts`. When the backend
 * is available, implement these functions against the real endpoints and swap
 * the mock imports for hooks that call them — no component changes required,
 * because every component is already typed against `src/types`.
 */

import type {
  AlertItem,
  AnalyticsBar,
  CameraFeed,
  HealthSlice,
  JourneyStop,
  KpiStat,
  VehicleRecord,
} from '@/types';
import type { AnalyticsFilters, AnalyticsSnapshot } from '@/types/analytics';
import type { HealthCamera } from '@/types/cameraHealth';
import type {
  InvestigationCase,
  InvestigationDossier,
  NewCasePayload,
  VehicleSighting,
} from '@/types/investigation';
import type {
  GenerateReportConfig,
  ReportPreviewDoc,
  ReportRecord,
  ScheduledReport,
} from '@/types/reports';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const API_ROOT = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/v1\/?$/, '') || '/api';

export interface RegistryCamera {
  camera_id: string;
  department: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  camera_type: string | null;
  codec: string | null;
  resolution: string | null;
  status: string | null;
  connectivity: string | null;
  vms: string | null;
  owner: string | null;
  rtsp_url: string | null;
  webrtc_url: string | null;
  hls_url: string | null;
}

export interface StreamStatusDto {
  camera_id: string;
  state: string;
  rtsp_configured: boolean;
  codec: string | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  source_fps: number | null;
  measured_fps: number;
  frame_count: number;
  last_pts_ms: number | null;
  last_frame_at: string | null;
  last_error: string | null;
  reconnect_attempt: number;
  next_retry_in_s: number | null;
  live_frame_path: string;
  live_mjpeg_path: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`[GP-API] ${response.status} ${response.statusText} for ${path}`);
  }

  return (await response.json()) as T;
}

/* The backend foundation (cameras, streams, vehicle intelligence) is served
   from `/api/...` directly rather than the versioned `/api/v1` REST surface the
   mock stubs above target. `apiRoot` calls that namespace. */
async function apiRoot<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`[GP-API] ${response.status} ${response.statusText} for ${path}`);
  }
  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Vehicle Intelligence Pipeline DTOs (mirror backend Pydantic models)
 * ------------------------------------------------------------------ */
export interface BBoxDto {
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface SightingDto {
  id: number;
  plate: string;
  plate_raw: string | null;
  camera_id: string;
  track_id: number | null;
  vehicle_class: string | null;
  ocr_confidence: number | null;
  detection_confidence: number | null;
  bbox: BBoxDto | null;
  pts_ms: number | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  evidence_path: string | null;
  seen_at: string | null;
}

export interface VehicleDto {
  id: number;
  plate: string;
  vehicle_class: string | null;
  first_seen: string | null;
  last_seen: string | null;
  last_camera_id: string | null;
  total_sightings: number;
  camera_count: number;
  best_confidence: number | null;
  recent_sightings?: SightingDto[] | null;
}

export interface JourneyPointDto {
  vehicle_id: number | null;
  journey_id: number;
  sequence: number;
  camera_id: string;
  timestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  confidence: number | null;
  distance_km: number | null;
  interval_seconds: number | null;
  speed_kph: number | null;
  anomaly: boolean;
  anomaly_reason: string | null;
}

export interface JourneyDto {
  plate: string;
  point_count: number;
  segment_count: number;
  anomaly_count: number;
  points: JourneyPointDto[];
}

export interface TrackDto {
  id: number;
  camera_id: string;
  track_id: number;
  vehicle_class: string | null;
  plate: string | null;
  first_seen: string | null;
  last_seen: string | null;
  frame_count: number;
  trajectory: Array<Record<string, number>>;
}

export const api = {
  getDashboardKpis: () => request<KpiStat[]>('/dashboard/kpis'),
  getLiveFeeds: (limit = 4) => request<CameraFeed[]>(`/cameras/live?limit=${limit}`),
  getRecentAlerts: (limit = 4) => request<AlertItem[]>(`/alerts/recent?limit=${limit}`),
  getCameraHealth: () => request<HealthSlice[]>('/cameras/health'),
  getVehicle: (plate: string) => request<VehicleRecord>(`/vehicles/${encodeURIComponent(plate)}`),
  getVehicleJourney: (plate: string) =>
    request<JourneyStop[]>(`/vehicles/${encodeURIComponent(plate)}/journey`),
  getAnalyticsToday: () => request<AnalyticsBar[]>('/analytics/today'),
  getAnalyticsSnapshot: (filters: AnalyticsFilters) => {
    const params = new URLSearchParams({
      range: filters.range,
      location: filters.location,
      camera: filters.camera,
    });
    return request<AnalyticsSnapshot>(`/analytics?${params.toString()}`);
  },

  /* Investigation console. `data/investigationData.ts` returns exactly these
     shapes today, so swapping the mock import for these calls is the only
     change the screen needs. */
  getInvestigation: (plate: string) =>
    request<InvestigationDossier>(`/investigations/${encodeURIComponent(plate)}`),
  getInvestigationSightings: (plate: string, range: string) => {
    const params = new URLSearchParams({ range });
    return request<VehicleSighting[]>(
      `/investigations/${encodeURIComponent(plate)}/sightings?${params.toString()}`,
    );
  },
  createInvestigationCase: (plate: string, payload: NewCasePayload) =>
    request<InvestigationCase>(`/investigations/${encodeURIComponent(plate)}/case`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /* Camera health console. `data/cameraHealthData.ts` serves these shapes
     today; the live grid replaces `liveCamera(camera, tick)` with the
     `camera:health` WebSocket frames described in `services/realtime.ts`. */
  getCameraHealthDetail: (cameraId: string) =>
    request<HealthCamera>(`/cameras/${encodeURIComponent(cameraId)}/health`),
  restartCameraStream: (cameraId: string) =>
    request<{ cameraId: string; state: string }>(`/cameras/${encodeURIComponent(cameraId)}/stream/restart`, {
      method: 'POST',
    }),

  /* Reports workspace. `data/reportsData.ts` serves these exact shapes today.
     The generation flow is: POST /reports/generate → 202 with the new report
     id → `report:status` WebSocket events until `completed` → the signed
     download URL from GET /reports/:id/download streams the rendered PDF. */
  getReports: (limit = 25) => request<ReportRecord[]>(`/reports?limit=${limit}`),
  generateReport: (config: GenerateReportConfig) =>
    request<ReportRecord>('/reports/generate', { method: 'POST', body: JSON.stringify(config) }),
  getReportPreview: (reportId: string) =>
    request<ReportPreviewDoc>(`/reports/${encodeURIComponent(reportId)}/preview`),
  getReportDownloadUrl: (reportId: string) =>
    request<{ url: string; expiresAt: string }>(`/reports/${encodeURIComponent(reportId)}/download`),
  shareReport: (reportId: string) =>
    request<{ url: string; expiresAt: string }>(`/reports/${encodeURIComponent(reportId)}/share`, {
      method: 'POST',
    }),
  getReportSchedules: () => request<ScheduledReport[]>('/reports/schedules'),
  createReportSchedule: (config: GenerateReportConfig) =>
    request<ScheduledReport>('/reports/schedules', { method: 'POST', body: JSON.stringify(config) }),
  toggleReportSchedule: (scheduleId: string, active: boolean) =>
    request<ScheduledReport>(`/reports/schedules/${encodeURIComponent(scheduleId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  /* ------------------------------------------------------------------ *
   * Camera Registry + Stream Gateway (backend foundation, `/api/...`).
   * ------------------------------------------------------------------ */
  getRegistryCameras: () => apiRoot<RegistryCamera[]>('/cameras'),
  getStreams: () => apiRoot<StreamStatusDto[]>('/streams'),

  /* ------------------------------------------------------------------ *
   * Vehicle Intelligence Pipeline (real ANPR / tracking / journeys).
   * ------------------------------------------------------------------ */
  searchVehicles: (q: string, limit = 25) =>
    apiRoot<VehicleDto[]>(`/vehicles/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  getVehicleIdentity: (plate: string) =>
    apiRoot<VehicleDto>(`/vehicles/${encodeURIComponent(plate)}`),
  getVehicleSightings: (plate: string, limit = 200) =>
    apiRoot<SightingDto[]>(`/vehicles/${encodeURIComponent(plate)}/sightings?limit=${limit}`),
  getVehicleJourneyReal: (plate: string) =>
    apiRoot<JourneyDto>(`/vehicles/${encodeURIComponent(plate)}/journey`),
  getRecentDetections: (limit = 50, cameraId?: string) =>
    apiRoot<SightingDto[]>(
      `/detections/recent?limit=${limit}${cameraId ? `&camera_id=${encodeURIComponent(cameraId)}` : ''}`,
    ),
  getRecentAnpr: (limit = 50, cameraId?: string) =>
    apiRoot<SightingDto[]>(
      `/anpr/recent?limit=${limit}${cameraId ? `&camera_id=${encodeURIComponent(cameraId)}` : ''}`,
    ),
  getRecentTracking: (limit = 50, cameraId?: string) =>
    apiRoot<TrackDto[]>(
      `/tracking/recent?limit=${limit}${cameraId ? `&camera_id=${encodeURIComponent(cameraId)}` : ''}`,
    ),
  getRecentJourneys: (limit = 25) => apiRoot<VehicleDto[]>(`/journeys/recent?limit=${limit}`),
  getPipelineStatus: () => apiRoot<unknown[]>('/pipeline'),
};

/** Fire-and-forget wrapper used by the console until the gateway exists. */
export function restartCameraStream(cameraId: string): Promise<unknown> {
  return api.restartCameraStream(cameraId).catch(() => undefined);
}
