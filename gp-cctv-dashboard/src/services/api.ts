/**
 * REST client for the Gujarat Police CCTV Intelligence FastAPI backend.
 *
 * Every backend route is served under the single production prefix `/api`
 * (there is NO `/api/v1` namespace). All helpers target `API_BASE` (=`/api`)
 * from `src/config.ts`, which the dashboard reaches same-origin through the
 * reverse proxy in production and via the Vite proxy in local development.
 *
 * Types in this file mirror the FastAPI Pydantic response schemas 1:1 so that
 * swapped-in real data matches the existing UI contracts.
 */

import { API_BASE } from '@/config';
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
  /** Secret-free capability flags — stream URLs are NEVER sent to the browser. */
  rtsp_configured: boolean;
  webrtc_configured: boolean;
  hls_configured: boolean;
  /** Same-origin, credential-free playback paths served by this backend. */
  hls_path?: string | null;
  live_frame_path?: string | null;
  live_mjpeg_path?: string | null;
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
  /** Sentinel Grid: active input transport ("rtsp" | "hls"). */
  transport?: string;
  hls_configured?: boolean;
  /** Dashboard availability: ONLINE | CONNECTING | OFFLINE | ERROR. */
  availability?: string;
  hls_path?: string | null;
}

/** Single request helper targeting the unified `/api` FastAPI base. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: authHeaders(init?.headers),
  });

  if (!response.ok) {
    throw new Error(`[GP-API] ${response.status} ${response.statusText} for ${path}`);
  }

  return (await response.json()) as T;
}

/* Backward-compatible alias used by the live methods below (all hit `/api`). */
const apiRoot = request;

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
  /** Reliability contract: false when the read is an uncertain OCR candidate. */
  plate_valid?: boolean;
  plate_uncertain?: boolean;
  /** Observation provenance (always live_rtsp for the pipeline). */
  source?: string | null;
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

/* ------------------------------------------------------------------ *
 * Phase 4 — Reports, Audit logs, System monitoring (real backend).
 * ------------------------------------------------------------------ */
export type RealReportType =
  | 'anpr_activity'
  | 'vehicle_journey'
  | 'watchlist_alerts'
  | 'camera_health'
  | 'investigation';

export interface ReportDto {
  id: number;
  report_id: string;
  name: string;
  type: RealReportType;
  status: 'completed' | 'generating' | 'failed';
  format: string;
  classification: string;
  date_from: string | null;
  date_to: string | null;
  camera_id: string | null;
  plate: string | null;
  alert_type: string | null;
  created_by: string | null;
  created_by_role: string | null;
  row_count: number;
  camera_count: number;
  file_size_bytes: number | null;
  error: string | null;
  summary: Record<string, unknown> | null;
  created_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  download_url: string;
  preview_url: string;
}

export interface ReportPage {
  items: ReportDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportGenerateInput {
  type: RealReportType;
  name?: string;
  format?: string;
  classification?: string;
  date_from?: string | null;
  date_to?: string | null;
  camera_id?: string | null;
  plate?: string | null;
  alert_type?: string | null;
}

export interface AuditLogDto {
  id: number;
  user_id: string | null;
  username: string | null;
  role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  result: string;
  detail: string | null;
  ip_address: string | null;
  user_agent: string | null;
  method: string | null;
  path: string | null;
  context: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AuditLogPage {
  items: AuditLogDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemMetricsDto {
  generated_at: string;
  service: string;
  environment: string;
  status: string;
  database: {
    status: string;
    postgis_available: boolean;
    pool: { size: number | null; checked_out: number | null; overflow: number | null };
  };
  registry: { total: number; with_rtsp: number };
  streams: {
    workers_total: number;
    live: number;
    by_state: Record<string, number>;
    avg_fps: number;
    sum_fps: number;
    frames_dropped_total: number;
    reconnect_attempts_total: number;
    max_workers_configured: number;
  };
  pipeline: {
    workers_total: number;
    workers_active: number;
    detector_ready_any: boolean;
    synthetic_any: boolean;
    frames_processed_total: number;
    frames_skipped_total: number;
    detections_total: number;
    anpr_reads_total: number;
    avg_inference_ms: number | null;
    avg_anpr_ms: number | null;
    queue_depth_total: number;
    max_workers_configured: number;
    max_concurrent_inference_configured: number;
  };
  websocket: { clients: number; history_depth: number; dropped_frames_total: number };
  recent_errors: Array<{ at: string; source: string; path: string | null; message: string }>;
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
  /* ------------------------------------------------------------------ *
   * Camera Registry + Stream Gateway (FastAPI `/api/...`).
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
  /** Global AI health (model readiness/device, ANPR state, worker trust). */
  getAiStatus: () =>
    apiRoot<{
      status: string;
      device: string | null;
      model: Record<string, unknown>;
      anpr: Record<string, unknown>;
      workers: Record<string, number>;
      runtime: Record<string, unknown>;
    }>('/ai/status'),
  /** Deterministic plate-identity cross-camera match (temporal/spatial checks). */
  getVehicleCrossCamera: (
    plate: string,
    params?: { max_gap_seconds?: number; max_speed_kph?: number; include_visual?: boolean },
  ) => {
    const search = new URLSearchParams();
    if (params?.max_gap_seconds !== undefined) search.set('max_gap_seconds', String(params.max_gap_seconds));
    if (params?.max_speed_kph !== undefined) search.set('max_speed_kph', String(params.max_speed_kph));
    if (params?.include_visual) search.set('include_visual', 'true');
    const qs = search.toString();
    return apiRoot<Record<string, unknown>>(
      `/vehicles/${encodeURIComponent(plate)}/cross-camera${qs ? `?${qs}` : ''}`,
    );
  },

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

  /* ---- Reports (real PostgreSQL data) ---- */
  getReports: (params?: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.type) search.set('type', params.type);
    if (params?.status) search.set('status', params.status);
    search.set('limit', String(params?.limit ?? 50));
    search.set('offset', String(params?.offset ?? 0));
    return apiRoot<ReportPage>(`/reports?${search.toString()}`);
  },
  generateReport: (payload: ReportGenerateInput) =>
    apiRoot<ReportDto>('/reports/generate', { method: 'POST', body: JSON.stringify(payload) }),
  getReportPreview: (reportId: string) =>
    apiRoot<ReportDto & { columns: string[]; rows: Record<string, unknown>[]; row_preview_count: number }>(
      `/reports/${encodeURIComponent(reportId)}/preview`,
    ),
  // Download URL (same-origin via the proxy).
  reportDownloadUrl: (reportId: string) => `${API_BASE}/reports/${encodeURIComponent(reportId)}/download`,

  /* ---- Audit logs (admin) ---- */
  getAuditLogs: (params?: {
    action?: string;
    resource_type?: string;
    username?: string;
    result?: string;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.action) search.set('action', params.action);
    if (params?.resource_type) search.set('resource_type', params.resource_type);
    if (params?.username) search.set('username', params.username);
    if (params?.result) search.set('result', params.result);
    search.set('limit', String(params?.limit ?? 100));
    search.set('offset', String(params?.offset ?? 0));
    return apiRoot<AuditLogPage>(`/audit-logs?${search.toString()}`);
  },

  /* ---- System monitoring ---- */
  getSystemMetrics: () => apiRoot<SystemMetricsDto>('/system/metrics'),
  getSystemHealth: () => apiRoot<Record<string, unknown>>('/system/health'),
};
