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

import { readStoredToken } from '@/services/realtime';

/** Bearer header when an access token is stored (AUTH_ENABLED deployments). */
function authHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = readStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers[key] = String(value);
  }
  return headers;
}

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
    ...init,
    headers: authHeaders(init?.headers),
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
    ...init,
    headers: authHeaders(init?.headers),
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


/* ------------------------------------------------------------------ *
 * Phase-3 DTOs (mirror the FastAPI Pydantic/service payloads)
 * ------------------------------------------------------------------ */
export interface WatchlistEntryDto {
  id: number;
  plate: string | null;
  plate_raw: string | null;
  entry_type: 'vehicle' | 'person' | 'other';
  label: string;
  alias: string | null;
  description: string | null;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  is_active: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  match_count: number;
  last_match_at: string | null;
}

export interface WatchlistEntryInput {
  plate?: string | null;
  entry_type?: 'vehicle' | 'person' | 'other';
  label?: string | null;
  alias?: string | null;
  description?: string | null;
  category?: string;
  priority?: string;
  is_active?: boolean;
}

export interface WatchlistMatchDto {
  id: number;
  entry_id: number;
  plate: string;
  camera_id: string;
  sighting_id: number;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  matched_at: string | null;
  alert_id: number | null;
  evidence_id: number | null;
  evidence_url: string | null;
  entry?: WatchlistEntryDto | null;
}

export interface WatchlistStatsDto {
  total_entries: number;
  active_entries: number;
  inactive_entries: number;
  matches: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  matches_timeseries: Array<{ day: string; matches: number }>;
  top_match_locations: Array<{ location_name: string | null; camera_id: string; matches: number }>;
  window_hours: number;
}

export interface WatchlistPage {
  items: WatchlistEntryDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface WatchlistMatchPage {
  items: WatchlistMatchDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertDto {
  id: number;
  alert_id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED';
  plate: string | null;
  camera_id: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  message: string;
  source_type: string;
  source_ref: string | null;
  evidence_id: number | null;
  evidence_url: string | null;
  dedupe_key: string;
  created_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  updated_at: string | null;
  confidence: number | null;
  watchlist_entry?: WatchlistEntryDto | null;
}

export interface AlertStatsDto {
  total: number;
  new: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  active: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  window_hours: number | null;
}

export interface AlertPage {
  items: AlertDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface GisCameraFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    camera_id: string;
    location_name: string | null;
    department: string | null;
    camera_type: string | null;
    codec: string | null;
    resolution: string | null;
    registry_status: string | null;
    rtsp_configured: boolean;
    health_state: string;
    stream_state: string | null;
    observed_fps: number | null;
    last_frame_at: string | null;
    last_error: string | null;
  };
}

export interface GisCamerasDto {
  type: 'FeatureCollection';
  features: GisCameraFeature[];
  count: number;
  postgis: boolean;
}

export interface GisSummaryDto {
  geocoded_cameras: number;
  states: Record<string, number>;
  departments: Record<string, number>;
  postgis: boolean;
}

export interface GisRouteDto {
  type: 'FeatureCollection';
  plate: string;
  journey_count: number;
  point_count: number;
  anomaly_count: number;
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: { type: 'LineString' | 'Point'; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
}

export interface GisNearbyDto {
  origin: { latitude: number; longitude: number };
  radius_m: number;
  engine: 'postgis' | 'haversine';
  count: number;
  cameras: Array<{
    camera_id: string;
    location_name: string | null;
    department: string | null;
    camera_type: string | null;
    registry_status: string | null;
    latitude: number | null;
    longitude: number | null;
    distance_m: number;
  }>;
}

export interface CameraHealthDto {
  camera_id: string;
  state: 'LIVE' | 'DEGRADED' | 'RECONNECTING' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';
  monitored: boolean;
  rtsp_configured: boolean | null;
  location_name: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  camera_type: string | null;
  registry_status: string | null;
  last_frame_at: string | null;
  last_success_at: string | null;
  reconnect_count: number;
  latency_ms: number | null;
  frame_age_s: number | null;
  codec: string | null;
  resolution: string | null;
  observed_fps: number | null;
  last_error: string | null;
  stream_started_at: string | null;
  updated_at: string | null;
  live_frame_path?: string;
  stream?: Record<string, unknown> | null;
}

export interface CameraHealthFleetDto {
  items: CameraHealthDto[];
  summary: {
    total: number;
    live: number;
    monitored: number;
    online_percent: number;
    counts: Record<string, number>;
  };
}

export interface CameraHealthEventDto {
  id: number;
  camera_id: string;
  from_state: string | null;
  to_state: string;
  reason: string | null;
  detail: string | null;
  created_at: string | null;
}

export interface DashboardKpisDto {
  window: { hours: number; since: string | null; until: string };
  total_cameras: number;
  live_cameras: number;
  offline_cameras: number;
  degraded_cameras: number;
  monitored_cameras: number;
  vehicles_detected: number;
  unique_vehicles: number;
  anpr_hits: number;
  watchlist_matches: number;
  watchlist_active_entries: number;
  active_alerts: number;
  new_alerts: number;
  camera_states: Record<string, number>;
  generated_at: string;
}

export interface ActivitySeriesDto {
  bucket: string;
  since: string;
  until: string;
  points: Array<{ bucket: string; detections: number; watchlist_matches: number; alerts: number }>;
}

export interface JourneySummaryDto {
  plate: string;
  journey_id: number;
  last_seen: string | null;
  stops: Array<{
    sequence: number;
    camera_id: string;
    location_name: string | null;
    timestamp: string | null;
    latitude: number | null;
    longitude: number | null;
    speed_kph: number | null;
    distance_km: number | null;
    anomaly: boolean;
  }>;
}

export interface AnalyticsSummaryDto {
  window: { hours: number; since: string | null; until: string };
  kpis: DashboardKpisDto;
  vehicle_types: Record<string, number>;
  hourly_histogram: number[];
  top_cameras: Array<{ camera_id: string; reads: number }>;
  anpr: { reads: number; avg_confidence: number };
  watchlist_matches: number;
  journey_anomalies: number;
  alerts: AlertStatsDto;
}

export interface EvidenceDto {
  id: number;
  event_type: string;
  event_id: string;
  camera_id: string;
  plate: string | null;
  captured_at: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  sha256: string;
  size_bytes: number | null;
  content_type: string;
  note: string | null;
  retention_until: string | null;
  created_at: string | null;
  image_url: string;
  download_url: string;
}

export interface EvidencePage {
  items: EvidenceDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface CaseDto {
  id: number;
  case_number: string;
  subject_plate: string;
  title: string;
  priority: string;
  status: string;
  notes: string | null;
  officer: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  evidence_ids: number[];
}

export interface CasePage {
  items: CaseDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface CaseCreateInput {
  subject_plate: string;
  title: string;
  priority?: string;
  notes?: string | null;
  officer?: string | null;
  evidence_ids?: number[];
}

export interface InvestigationTimelineItemDto {
  kind: 'sighting' | 'journey' | 'watchlist_match' | 'alert' | 'case';
  timestamp: string | null;
  camera_id: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  plate: string | null;
  detail: string;
  ref: string;
  evidence_id?: number | null;
  alert_id?: string | null;
  alert_type?: string | null;
  severity?: string | null;
  status?: string | null;
  confidence?: number | null;
  case_number?: string | null;
  watchlist_category?: string | null;
  watchlist_priority?: string | null;
}

export interface InvestigationTimelineDto {
  plate: string;
  count: number;
  items: InvestigationTimelineItemDto[];
}

export interface InvestigationDossierDto {
  plate: string;
  vehicle: VehicleDto;
  mean_confidence: number | null;
  cameras_seen: string[];
  watchlist: {
    match: boolean;
    entry_id?: number;
    label?: string;
    category?: string;
    priority?: string;
    description?: string | null;
    added_on?: string | null;
  };
  sightings: Array<{
    id: number;
    camera_id: string;
    timestamp: string | null;
    location_name: string | null;
    latitude: number | null;
    longitude: number | null;
    ocr_confidence: number;
    detection_confidence: number | null;
    vehicle_class: string | null;
    track_id: number | null;
    bbox: { x: number; y: number; w: number; h: number } | null;
    evidence_path: string | null;
  }>;
  journey_points: Array<{
    journey_id: number;
    sequence: number;
    camera_id: string;
    timestamp: string | null;
    location_name: string | null;
    latitude: number | null;
    longitude: number | null;
    distance_km: number | null;
    interval_seconds: number | null;
    speed_kph: number | null;
    anomaly: boolean;
    anomaly_reason: string | null;
  }>;
  tracks: Array<{
    id: number;
    camera_id: string;
    track_id: number;
    first_seen: string | null;
    last_seen: string | null;
    frame_count: number;
  }>;
  watchlist_matches: Array<{
    id: number;
    entry_id: number;
    camera_id: string;
    matched_at: string | null;
    location_name: string | null;
    confidence: number;
    alert_id: number | null;
    evidence_id: number | null;
  }>;
  alerts: Array<{
    alert_id: string;
    type: string;
    severity: string;
    status: string;
    camera_id: string | null;
    message: string;
    created_at: string | null;
    evidence_id: number | null;
  }>;
  cases: CaseDto[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  refresh_token: string;
  user: UserDto;
}

export interface CurrentUserDto {
  user_id: number | string;
  username: string;
  full_name: string;
  role: string;
  permissions: string[];
  open_mode: boolean;
}

export interface AuthConfigDto {
  auth_enabled: boolean;
  access_token_expire_minutes: number;
  refresh_token_expire_days: number;
  open_mode: boolean;
  available_permissions: string[];
}

export interface UserDto {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  rank: string | null;
  employee_id: string | null;
  department: string | null;
  location: string | null;
  phone: string | null;
  role: string;
  role_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  created_by: string | null;
  permissions?: string[];
}

export interface UserPage {
  items: UserDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name: string;
  role_id: string;
  email?: string | null;
  rank?: string | null;
  employee_id?: string | null;
  department?: string | null;
  location?: string | null;
  phone?: string | null;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  user_count: number | null;
  created_at: string | null;
  updated_at: string | null;
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

  /* ------------------------------------------------------------------ *
   * Phase-3 operational layer: Watchlist, Alerts, GIS, Camera Health,
   * Dashboard KPIs / Analytics, Investigation, Evidence, Auth / RBAC.
   * All served from the FastAPI backend under `/api/...`.
   * ------------------------------------------------------------------ */

  /* ---- Watchlist ---- */
  getWatchlist: (params?: {
    query?: string;
    category?: string;
    priority?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.query) search.set('query', params.query);
    if (params?.category && params.category !== 'all') search.set('category', params.category);
    if (params?.priority && params.priority !== 'all') search.set('priority', params.priority);
    if (params?.is_active !== undefined) search.set('is_active', String(params.is_active));
    search.set('limit', String(params?.limit ?? 500));
    search.set('offset', String(params?.offset ?? 0));
    return apiRoot<WatchlistPage>(`/watchlist?${search.toString()}`);
  },
  getWatchlistStats: (hours = 168) =>
    apiRoot<WatchlistStatsDto>(`/watchlist/stats?hours=${hours}`),
  getWatchlistMatches: (limit = 50) =>
    apiRoot<WatchlistMatchPage>(`/watchlist/matches?limit=${limit}`),
  createWatchlistEntry: (payload: WatchlistEntryInput) =>
    apiRoot<WatchlistEntryDto>('/watchlist', { method: 'POST', body: JSON.stringify(payload) }),
  updateWatchlistEntry: (id: number, payload: Partial<WatchlistEntryInput>) =>
    apiRoot<WatchlistEntryDto>(`/watchlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteWatchlistEntry: (id: number) => apiRoot<{ deleted: number }>(`/watchlist/${id}`, { method: 'DELETE' }),

  /* ---- Real-Time Alerts ---- */
  getAlerts: (params?: {
    status?: string;
    severity?: string;
    type?: string;
    camera_id?: string;
    plate?: string;
    hours?: number;
    open_only?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.status && params.status !== 'all') search.set('status', params.status);
    if (params?.severity && params.severity !== 'all') search.set('severity', params.severity);
    if (params?.type && params.type !== 'all') search.set('type', params.type);
    if (params?.camera_id) search.set('camera_id', params.camera_id);
    if (params?.plate) search.set('plate', params.plate);
    if (params?.hours) search.set('hours', String(params.hours));
    if (params?.open_only) search.set('open_only', 'true');
    search.set('limit', String(params?.limit ?? 100));
    search.set('offset', String(params?.offset ?? 0));
    return apiRoot<AlertPage>(`/alerts/recent?${search.toString()}`);
  },
  getAlertStats: (hours = 24) => apiRoot<AlertStatsDto>(`/alerts/stats?hours=${hours}`),
  acknowledgeAlert: (alertId: string) =>
    apiRoot<AlertDto>(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST' }),
  resolveAlert: (alertId: string, note?: string) =>
    apiRoot<AlertDto>(`/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note: note ?? null }),
    }),
  setAlertStatus: (alertId: string, status: string, note?: string) =>
    apiRoot<AlertDto>(`/alerts/${encodeURIComponent(alertId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note: note ?? null }),
    }),

  /* ---- GIS intelligence ---- */
  getGisCameras: () => apiRoot<GisCamerasDto>('/gis/cameras'),
  getGisSummary: () => apiRoot<GisSummaryDto>('/gis/summary'),
  getGisVehicleRoute: (plate: string) =>
    apiRoot<GisRouteDto>(`/gis/vehicle/${encodeURIComponent(plate)}/route`),
  getGisNearby: (lat: number, lng: number, radiusM = 2000, limit = 20) =>
    apiRoot<GisNearbyDto>(
      `/gis/nearby?lat=${lat}&lng=${lng}&radius_m=${radiusM}&limit=${limit}`,
    ),

  /* ---- Camera health ---- */
  getCameraHealthFleet: () => apiRoot<CameraHealthFleetDto>('/cameras/health'),
  getCameraHealthEvents: (limit = 50) =>
    apiRoot<CameraHealthEventDto[]>(`/cameras/health/events?limit=${limit}`),
  restartCameraStreamReal: (cameraId: string) =>
    apiRoot<unknown>(`/cameras/${encodeURIComponent(cameraId)}/stream/restart`, { method: 'POST' }),

  /* ---- Dashboard KPIs + analytics ---- */
  getDashboardKpisReal: (hours = 24) => apiRoot<DashboardKpisDto>(`/dashboard/kpis?hours=${hours}`),
  getDashboardActivity: (hours = 24, bucket: 'hour' | 'day' | 'minute' = 'hour') =>
    apiRoot<ActivitySeriesDto>(`/dashboard/activity?hours=${hours}&bucket=${bucket}`),
  getDashboardJourneys: (limit = 6) => apiRoot<JourneySummaryDto[]>(`/dashboard/journeys?limit=${limit}`),
  getAnalyticsSummary: (hours = 24) => apiRoot<AnalyticsSummaryDto>(`/analytics/summary?hours=${hours}`),

  /* ---- Investigation ---- */
  getInvestigationDossier: (plate: string) =>
    apiRoot<InvestigationDossierDto>(`/investigation/${encodeURIComponent(plate)}/dossier`),
  getInvestigationTimeline: (plate: string, limit = 200) =>
    apiRoot<InvestigationTimelineDto>(
      `/investigation/${encodeURIComponent(plate)}/timeline?limit=${limit}`,
    ),
  getInvestigationCases: (plate?: string) =>
    apiRoot<CasePage>(
      `/investigation/cases${plate ? `?plate=${encodeURIComponent(plate)}` : '?limit=50'}`,
    ),
  createInvestigationCaseReal: (payload: CaseCreateInput) =>
    apiRoot<CaseDto>('/investigation/cases', { method: 'POST', body: JSON.stringify(payload) }),
  searchInvestigation: (q: string, limit = 25) =>
    apiRoot<VehicleDto[]>(`/investigation/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  /* ---- Evidence ---- */
  getEvidence: (params?: { plate?: string; camera_id?: string; event_type?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.plate) search.set('plate', params.plate);
    if (params?.camera_id) search.set('camera_id', params.camera_id);
    if (params?.event_type) search.set('event_type', params.event_type);
    search.set('limit', String(params?.limit ?? 100));
    return apiRoot<EvidencePage>(`/evidence?${search.toString()}`);
  },

  /* ---- Auth / RBAC ---- */
  login: (username: string, password: string) =>
    apiRoot<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getCurrentUser: () => apiRoot<CurrentUserDto>('/auth/me'),
  getAuthConfig: () => apiRoot<AuthConfigDto>('/auth/config'),
  getUsers: (limit = 200) => apiRoot<UserPage>(`/users?limit=${limit}`),
  createUser: (payload: CreateUserInput) =>
    apiRoot<UserDto>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  getRoles: () => apiRoot<RoleDto[]>('/roles'),
};

/** Fire-and-forget wrapper used by the console until the gateway exists. */
export function restartCameraStream(cameraId: string): Promise<unknown> {
  return api.restartCameraStream(cameraId).catch(() => undefined);
}
