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
};
