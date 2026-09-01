/**
 * Analytics workspace types.
 *
 * The UI reads an `AnalyticsSnapshot` produced by `computeAnalytics()` in
 * `data/analyticsData.ts`. When the backend lands, `services/api.ts` should
 * return the same shape so panels stay unchanged.
 */

export type DateRangeId = 'today' | '24h' | '7d' | '30d';
export type LocationId = 'all' | 'ahmedabad' | 'gandhinagar' | 'vadodara' | 'surat' | 'rajkot';
export type CameraFilterId = 'all' | string;
export type TrendDirection = 'up' | 'down' | 'flat';
export type CameraHealth = 'online' | 'warning' | 'critical' | 'offline';
export type InsightTone = 'cyan' | 'blue' | 'green' | 'orange' | 'red' | 'purple';

export interface AnalyticsFilters {
  range: DateRangeId;
  location: LocationId;
  camera: CameraFilterId;
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface AnalyticsKpis {
  vehicles: number;
  vehiclesDelta: number;
  anpr: number;
  anprShare: number;
  events: number;
  eventsOpen: number;
  watchlist: number;
  watchlistCritical: number;
  cameras: number;
  camerasPct: number;
  fleet: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface WatchlistTrendPoint {
  label: string;
  matches: number;
  critical: number;
}

export interface VehicleTypeSlice {
  id: 'cars' | 'twoWheelers' | 'heavy' | 'buses';
  label: string;
  value: number;
  color: string;
}

export interface EventTypeBar {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface AnprStats {
  processed: number;
  successful: number;
  unreadable: number;
  confidence: number;
  high: number;
  medium: number;
  low: number;
  latencyMs: number;
}

export interface CameraActivityRow {
  id: string;
  code: string;
  location: string;
  city: string;
  locationId: LocationId;
  detections: number;
  events: number;
  status: CameraHealth;
}

export interface DetectionLocation {
  id: string;
  rank: number;
  name: string;
  city: string;
  locationId: LocationId;
  detections: number;
  share: number;
  trend: TrendDirection;
  peak: string;
}

export interface HeatmapGrid {
  days: string[];
  dayKeys: string[];
  hours: number[];
  /** cells[dayIndex][hour] — vehicle detections */
  cells: number[][];
  max: number;
}

export interface InsightCard {
  id: string;
  tone: InsightTone;
  kicker: string;
  title: string;
  body: string;
  metric: string;
}

export interface UnusualEvent {
  id: string;
  time: string;
  text: string;
  tone: InsightTone;
  camera?: string;
  locationId: LocationId;
}

export interface AnalyticsSnapshot {
  filters: AnalyticsFilters;
  rangeLabel: string;
  locationLabel: string;
  cameraLabel: string;
  windowNote: string;
  generatedAt: string;
  kpis: AnalyticsKpis;
  vehicleTrend: TrendPoint[];
  vehicleTrendUnit: 'hour' | 'day';
  vehicleTypes: VehicleTypeSlice[];
  eventTypes: EventTypeBar[];
  anpr: AnprStats;
  cameras: CameraActivityRow[];
  locations: DetectionLocation[];
  watchlistTrend: WatchlistTrendPoint[];
  heatmap: HeatmapGrid;
  insights: InsightCard[];
  unusual: UnusualEvent[];
  peakLabel: string;
  peakValue: number;
}
