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
};

/** Fire-and-forget wrapper used by the console until the gateway exists. */
export function restartCameraStream(cameraId: string): Promise<unknown> {
  return api.restartCameraStream(cameraId).catch(() => undefined);
}
