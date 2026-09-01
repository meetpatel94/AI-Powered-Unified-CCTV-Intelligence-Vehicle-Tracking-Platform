import { distribute, peakOf } from '@/components/analytics/chartMath';
import type {
  AnalyticsFilters,
  AnalyticsSnapshot,
  AnprStats,
  CameraActivityRow,
  CameraFilterId,
  DateRangeId,
  DetectionLocation,
  EventTypeBar,
  HeatmapGrid,
  InsightCard,
  LocationId,
  SelectOption,
  UnusualEvent,
  VehicleTypeSlice,
  WatchlistTrendPoint,
} from '@/types/analytics';

/* ------------------------------------------------------------------ *
 * Reference clock — same narrative "now" as Alerts / Live View:
 * 10:46 IST, Tuesday 01 Sep 2026.
 * ------------------------------------------------------------------ */

export const ANALYTICS_AS_OF = '10:46 AM IST';
export const ANALYTICS_DATE = '01 Sep 2026';

export const dateRangeOptions: SelectOption[] = [
  { id: 'today', label: 'Today · 01 Sep' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
];

export const locationOptions: SelectOption[] = [
  { id: 'all', label: 'All Gujarat' },
  { id: 'ahmedabad', label: 'Ahmedabad City' },
  { id: 'gandhinagar', label: 'Gandhinagar' },
  { id: 'vadodara', label: 'Vadodara' },
  { id: 'surat', label: 'Surat' },
  { id: 'rajkot', label: 'Rajkot' },
];

const RANGE_NOTE: Record<DateRangeId, string> = {
  today: 'today · 00:00–10:46 IST',
  '24h': 'rolling 24 h · 31 Aug 10:46 → 01 Sep 10:46',
  '7d': '26 Aug – 01 Sep 2026',
  '30d': '03 Aug – 01 Sep 2026',
};

const RANGE_LABEL: Record<DateRangeId, string> = {
  today: 'Today (01 Sep 2026)',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

/* ------------------------------------------------------------------ *
 * Canonical TODAY / all-Gujarat / all-cameras baselines.
 * Vehicles 18,729 · ANPR 14,382 · AI events 2,846 · WL 7 · cameras 11,243
 * ------------------------------------------------------------------ */

const TODAY_VEHICLES = 18729;
const TODAY_ANPR = 14382;
const TODAY_EVENTS = 2846;
const TODAY_WATCHLIST = 7;
const TODAY_CAMERAS = 11243;
const FLEET = 12842;

/** Hourly vehicle detections 00–23 summing to 18,729. Morning peak 08–10. */
export const TODAY_HOURLY: number[] = [
  62, 41, 28, 24, 36, 98, 340, 860, 1580, 1870, 1460, 1080, 920, 810, 860, 980, 1210, 1640, 1790, 1320, 790, 490, 280,
  160,
];

const TYPE_WEIGHTS = [6084, 9642, 2153, 850];
const TYPE_META: Array<Omit<VehicleTypeSlice, 'value'>> = [
  { id: 'cars', label: 'Cars', color: '#2f7dff' },
  { id: 'twoWheelers', label: 'Two Wheelers', color: '#22c55e' },
  { id: 'heavy', label: 'Heavy Vehicles', color: '#f59e0b' },
  { id: 'buses', label: 'Buses', color: '#a855f7' },
];

const EVENT_WEIGHTS = [986, 412, 318, 642, 374, 114];
const EVENT_META: Array<Omit<EventTypeBar, 'value'>> = [
  { id: 'speed', label: 'Speed Violation', color: '#f59e0b' },
  { id: 'wrongdir', label: 'Wrong Direction', color: '#a855f7' },
  { id: 'crowd', label: 'Crowd Detected', color: '#22d3ee' },
  { id: 'helmet', label: 'No Helmet', color: '#eab308' },
  { id: 'signal', label: 'Signal Jump', color: '#2f7dff' },
  { id: 'other', label: 'Other Events', color: '#64748b' },
];

interface CameraSeed {
  code: string;
  location: string;
  city: string;
  locationId: LocationId;
  detections: number;
  events: number;
  status: CameraActivityRow['status'];
}

const CAMERA_SEED: CameraSeed[] = [
  { code: 'C-115', location: 'S.G. Highway', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 2841, events: 86, status: 'critical' },
  { code: 'C-038', location: 'Gift City Road', city: 'Gandhinagar', locationId: 'gandhinagar', detections: 2412, events: 54, status: 'critical' },
  { code: 'C-001', location: 'Shahibaug Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1986, events: 41, status: 'online' },
  { code: 'C-007', location: 'Naranpura Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1654, events: 33, status: 'online' },
  { code: 'C-207', location: 'Vadodara City Center', city: 'Vadodara', locationId: 'vadodara', detections: 1428, events: 38, status: 'online' },
  { code: 'C-045', location: 'Iskcon Circle', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1210, events: 47, status: 'online' },
  { code: 'C-015', location: 'Kudasan Road', city: 'Gandhinagar', locationId: 'gandhinagar', detections: 1088, events: 29, status: 'online' },
  { code: 'C-089', location: 'Maninagar Junction', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 942, events: 36, status: 'warning' },
  { code: 'C-052', location: 'Vastrapur Lake Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 816, events: 22, status: 'online' },
  { code: 'C-131', location: 'Kalawad Road', city: 'Rajkot', locationId: 'rajkot', detections: 674, events: 19, status: 'online' },
  { code: 'C-160', location: 'Ring Road', city: 'Surat', locationId: 'surat', detections: 412, events: 14, status: 'offline' },
];

export const cameraOptions: SelectOption[] = [
  { id: 'all', label: 'All Cameras' },
  ...CAMERA_SEED.map((camera) => ({
    id: camera.code,
    label: `${camera.code} · ${camera.location}`,
  })),
];

interface LocationSeed {
  id: string;
  name: string;
  city: string;
  locationId: LocationId;
  detections: number;
  trend: DetectionLocation['trend'];
  peak: string;
}

const LOCATION_SEED: LocationSeed[] = [
  { id: 'gift', name: 'Gift City Road', city: 'Gandhinagar', locationId: 'gandhinagar', detections: 3246, trend: 'up', peak: '08:40–10:44' },
  { id: 'sg', name: 'S.G. Highway', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 2841, trend: 'up', peak: '08:15–10:42' },
  { id: 'shahi', name: 'Shahibaug Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1986, trend: 'flat', peak: '08:50–10:28' },
  { id: 'naran', name: 'Naranpura Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1654, trend: 'up', peak: '09:05–10:21' },
  { id: 'vado', name: 'Vadodara City Center', city: 'Vadodara', locationId: 'vadodara', detections: 1428, trend: 'up', peak: '09:10–10:38' },
  { id: 'iskcon', name: 'Iskcon Circle', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 1210, trend: 'down', peak: '08:48–10:20' },
  { id: 'kuda', name: 'Kudasan Road', city: 'Gandhinagar', locationId: 'gandhinagar', detections: 1088, trend: 'flat', peak: '08:30–10:34' },
  { id: 'mani', name: 'Maninagar Junction', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 942, trend: 'up', peak: '09:40–10:35' },
  { id: 'vastra', name: 'Vastrapur Lake Road', city: 'Ahmedabad', locationId: 'ahmedabad', detections: 816, trend: 'down', peak: '08:33–10:25' },
  { id: 'kala', name: 'Kalawad Road', city: 'Rajkot', locationId: 'rajkot', detections: 674, trend: 'flat', peak: '09:09–10:13' },
  { id: 'ring', name: 'Ring Road', city: 'Surat', locationId: 'surat', detections: 412, trend: 'down', peak: '09:20–10:43' },
];

const LOC_SHARE: Record<LocationId, number> = {
  all: 1,
  ahmedabad: 0.51,
  gandhinagar: 0.19,
  vadodara: 0.13,
  surat: 0.1,
  rajkot: 0.07,
};

const LOC_CAMERAS: Record<LocationId, number> = {
  all: TODAY_CAMERAS,
  ahmedabad: 5820,
  gandhinagar: 1944,
  vadodara: 1488,
  surat: 1261,
  rajkot: 730,
};

const RANGE_KPI: Record<
  DateRangeId,
  { vehicles: number; anpr: number; events: number; watchlist: number; cameras: number; delta: number }
> = {
  today: { vehicles: TODAY_VEHICLES, anpr: TODAY_ANPR, events: TODAY_EVENTS, watchlist: TODAY_WATCHLIST, cameras: TODAY_CAMERAS, delta: 12.5 },
  '24h': { vehicles: 20140, anpr: 15480, events: 3012, watchlist: 9, cameras: TODAY_CAMERAS, delta: 8.4 },
  '7d': { vehicles: 118640, anpr: 91220, events: 16840, watchlist: 72, cameras: 11402, delta: 6.8 },
  '30d': { vehicles: 446180, anpr: 342900, events: 61240, watchlist: 186, cameras: 11580, delta: 4.2 },
};

/** Last 14 days ending 01 Sep — matches + critical overlay. */
const WL_14: WatchlistTrendPoint[] = [
  { label: '19', matches: 5, critical: 1 },
  { label: '20', matches: 4, critical: 0 },
  { label: '21', matches: 7, critical: 2 },
  { label: '22', matches: 6, critical: 1 },
  { label: '23', matches: 9, critical: 3 },
  { label: '24', matches: 8, critical: 2 },
  { label: '25', matches: 6, critical: 1 },
  { label: '26', matches: 10, critical: 3 },
  { label: '27', matches: 12, critical: 4 },
  { label: '28', matches: 9, critical: 2 },
  { label: '29', matches: 13, critical: 4 },
  { label: '30', matches: 10, critical: 3 },
  { label: '31', matches: 11, critical: 3 },
  { label: '01', matches: 7, critical: 2 },
];

const WEEK_DAILY_VEHICLES = [15840, 17220, 18110, 14680, 13240, 20821, 18729];
const WEEK_LABELS = ['26', '27', '28', '29', '30', '31', '01'];

const UNUSUAL_SEED: UnusualEvent[] = [
  {
    id: 'u1',
    time: '10:44',
    text: 'Watchlist GJ01AB1234 reconstructed across 4 cameras — Shahibaug → Naranpura → Kudasan → Gift City (98.7%)',
    tone: 'red',
    camera: 'C-038',
    locationId: 'gandhinagar',
  },
  {
    id: 'u2',
    time: '10:42',
    text: 'Speed cluster 132 km/h · GJ05JK6789 on S.G. Highway (limit 70) — e-challan TC-99051/2026 queued',
    tone: 'orange',
    camera: 'C-115',
    locationId: 'ahmedabad',
  },
  {
    id: 'u3',
    time: '10:38',
    text: 'Wrong-direction GJ18CD4521 on MC Circle flydown, Vadodara — 2 near-miss events with two-wheelers',
    tone: 'purple',
    camera: 'C-207',
    locationId: 'vadodara',
  },
  {
    id: 'u4',
    time: '10:35',
    text: 'Crowd density 3.4 pax/m² at Maninagar Junction after signal fault — ~140 persons, trend stable',
    tone: 'cyan',
    camera: 'C-089',
    locationId: 'ahmedabad',
  },
  {
    id: 'u5',
    time: '10:43',
    text: 'C-160 Ring Road, Surat — RTSP flap, 38 s heartbeat gap, packet loss 12.4% (reconnecting)',
    tone: 'orange',
    camera: 'C-160',
    locationId: 'surat',
  },
  {
    id: 'u6',
    time: '10:13',
    text: 'Plateless motorcycle cluster at Kalawad Road — 11 detections this week, no stolen-list hit',
    tone: 'blue',
    camera: 'C-131',
    locationId: 'rajkot',
  },
];

/* ------------------------------------------------------------------ *
 * Series builders
 * ------------------------------------------------------------------ */

function hash(n: number): number {
  return ((n * 9301 + 49297) % 233280) / 233280;
}

function scaleInt(n: number, factor: number): number {
  return Math.max(0, Math.round(n * factor));
}

function factorFor(filters: AnalyticsFilters): { share: number; range: (typeof RANGE_KPI)[DateRangeId]; camera: CameraSeed | null } {
  const range = RANGE_KPI[filters.range];
  const camera = filters.camera === 'all' ? null : (CAMERA_SEED.find((row) => row.code === filters.camera) ?? null);
  if (camera) {
    const inLocation = filters.location === 'all' || camera.locationId === filters.location;
    return { share: inLocation ? camera.detections / TODAY_VEHICLES : 0, range, camera: inLocation ? camera : null };
  }
  return { share: LOC_SHARE[filters.location], range, camera: null };
}

function todayHourlyScaled(share: number): Array<{ label: string; value: number }> {
  const total = scaleInt(TODAY_VEHICLES, share);
  const values = distribute(total, TODAY_HOURLY);
  return values.map((value, hour) => ({ label: String(hour).padStart(2, '0'), value }));
}

function last24hScaled(share: number): Array<{ label: string; value: number }> {
  /* 11:00 31 Aug → 10:00 01 Sep. Yesterday evening from TODAY_HOURLY, plus today morning. */
  const yShare = share * 0.92;
  const yesterday = distribute(scaleInt(TODAY_VEHICLES, yShare), TODAY_HOURLY);
  const today = distribute(scaleInt(TODAY_VEHICLES, share), TODAY_HOURLY);
  const hours: Array<{ label: string; value: number }> = [];
  for (let h = 11; h < 24; h += 1) hours.push({ label: String(h).padStart(2, '0'), value: yesterday[h] });
  for (let h = 0; h <= 10; h += 1) hours.push({ label: String(h).padStart(2, '0'), value: today[h] });
  return hours;
}

function weekDailyScaled(share: number): Array<{ label: string; value: number }> {
  const total = scaleInt(RANGE_KPI['7d'].vehicles, share);
  const values = distribute(total, WEEK_DAILY_VEHICLES);
  return WEEK_LABELS.map((label, index) => ({ label, value: values[index] }));
}

function monthDailyScaled(share: number): Array<{ label: string; value: number }> {
  const weights: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dow = (1 + i) % 7; // 3 Aug 2026 = Monday
    const weekend = dow === 0 || dow === 6;
    const wave = 1 + 0.07 * Math.sin(i / 3.4);
    const base = weekend ? 0.78 : 1;
    weights.push(base * wave * (0.92 + hash(i + 9) * 0.16));
  }
  weights[29] = Math.max(weights[29], 1.05);
  const total = scaleInt(RANGE_KPI['30d'].vehicles, share);
  const values = distribute(total, weights);
  const out: Array<{ label: string; value: number }> = [];
  const start = new Date(Date.UTC(2026, 7, 3));
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push({ label: String(d.getUTCDate()).padStart(2, '0'), value: values[i] });
  }
  return out;
}

function watchlistSeries(filters: AnalyticsFilters, share: number): WatchlistTrendPoint[] {
  const scalePoint = (point: WatchlistTrendPoint): WatchlistTrendPoint => ({
    label: point.label,
    matches: scaleInt(point.matches, share),
    critical: Math.min(scaleInt(point.matches, share), scaleInt(point.critical, share)),
  });

  if (filters.range === '7d') return WL_14.slice(7).map(scalePoint);
  if (filters.range === '30d') {
    const month: WatchlistTrendPoint[] = [];
    const start = new Date(Date.UTC(2026, 7, 3));
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(start.getTime() + i * 86400000);
      const dow = d.getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const matches = scaleInt((weekend ? 4 : 7) + Math.round(hash(i + 4) * 6), share);
      const critical = Math.min(matches, scaleInt(Math.round(matches * 0.32), 1));
      month.push({ label: String(d.getUTCDate()).padStart(2, '0'), matches, critical });
    }
    month[29] = { label: '01', matches: scaleInt(TODAY_WATCHLIST, share), critical: Math.min(scaleInt(TODAY_WATCHLIST, share), scaleInt(2, share) || (share > 0.3 ? 2 : 1) ) };
    return month;
  }
  if (filters.range === '24h') {
    const hours = last24hScaled(share);
    return hours.map((point, index) => {
      const rush = Number(point.label) >= 8 && Number(point.label) <= 11;
      const matches = rush ? scaleInt(index % 3 === 0 ? 2 : 1, share) : 0;
      return { label: point.label, matches, critical: matches > 1 ? 1 : 0 };
    });
  }
  return WL_14.map(scalePoint);
}

function buildHeatmap(share: number): HeatmapGrid {
  const days = ['26 Wed', '27 Thu', '28 Fri', '29 Sat', '30 Sun', '31 Mon', '01 Tue'];
  const dayKeys = ['26 Aug', '27 Aug', '28 Aug', '29 Aug', '30 Aug', '31 Aug', '01 Sep'];
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const cells: number[][] = days.map((_, day) =>
    hours.map((hour) => {
      const weekend = day === 3 || day === 4;
      const morning = hour >= 8 && hour <= 10;
      const evening = hour >= 17 && hour <= 19;
      const core = hour >= 7 && hour <= 21;
      let intensity = 0.1;
      if (morning) intensity = 1;
      else if (evening) intensity = 0.94;
      else if (core) intensity = 0.52;
      if (weekend) intensity *= hour >= 11 && hour <= 20 ? 0.72 : 0.38;
      const noise = 0.82 + hash(day * 24 + hour + 3) * 0.28;
      const todayCut = day === 6 && hour > 10 ? 0 : 1;
      return scaleInt(TODAY_HOURLY[hour] * intensity * noise * todayCut, share);
    }),
  );
  let max = 1;
  cells.forEach((row) => row.forEach((value) => {
    if (value > max) max = value;
  }));
  return { days, dayKeys, hours, cells, max };
}

function buildInsights(args: {
  trend: Array<{ label: string; value: number }>;
  unit: 'hour' | 'day';
  locations: DetectionLocation[];
  events: EventTypeBar[];
  anpr: AnprStats;
  kpis: AnalyticsSnapshot['kpis'];
  types: VehicleTypeSlice[];
  windowNote: string;
}): InsightCard[] {
  const peak = peakOf(args.trend);
  const topLoc = args.locations[0];
  const topEvent = [...args.events].sort((a, b) => b.value - a.value)[0];
  const twoW = args.types.find((slice) => slice.id === 'twoWheelers');
  const peakShare = args.kpis.vehicles > 0 ? (peak.value / args.kpis.vehicles) * 100 : 0;
  const eventShare = args.kpis.events > 0 && topEvent ? (topEvent.value / args.kpis.events) * 100 : 0;
  const peakTitle = args.unit === 'hour' ? `${peak.label}:00–${String((Number(peak.label) + 2) % 24).padStart(2, '0')}:00 IST` : `${peak.label} Aug/Sep`;

  return [
    {
      id: 'peak',
      tone: 'cyan',
      kicker: 'Peak traffic period',
      title: args.unit === 'hour' ? peakTitle : `Peak day ${peak.label}`,
      metric: peak.value.toLocaleString('en-IN'),
      body:
        args.unit === 'hour'
          ? `${peak.value.toLocaleString('en-IN')} vehicles in the peak hour — ${peakShare.toFixed(1)}% of ${args.windowNote}. Morning rush 08:00–10:00 remains the dominant corridor load.`
          : `${peak.value.toLocaleString('en-IN')} vehicles on ${peak.label} — highest day in the selected window.`,
    },
    {
      id: 'location',
      tone: 'blue',
      kicker: 'Highest detection location',
      title: topLoc ? `${topLoc.name}` : '—',
      metric: topLoc ? topLoc.detections.toLocaleString('en-IN') : '0',
      body: topLoc
        ? `${topLoc.city} · ${topLoc.share.toFixed(1)}% of detections · peak ${topLoc.peak}. Gift City / S.G. Highway corridor continues to dominate ANPR volume.`
        : 'No location in the current filter.',
    },
    {
      id: 'alert',
      tone: 'orange',
      kicker: 'Highest alert category',
      title: topEvent?.label ?? '—',
      metric: topEvent ? topEvent.value.toLocaleString('en-IN') : '0',
      body: topEvent
        ? `${eventShare.toFixed(1)}% of ${args.kpis.events.toLocaleString('en-IN')} AI events. Speed + helmet enforcement remain the primary traffic-branch load.`
        : 'No AI events in the current filter.',
    },
    {
      id: 'anpr',
      tone: 'green',
      kicker: 'ANPR confidence',
      title: `${args.anpr.confidence.toFixed(1)}% mean OCR`,
      metric: args.anpr.successful.toLocaleString('en-IN'),
      body: `${args.anpr.successful.toLocaleString('en-IN')} successful reads of ${args.anpr.processed.toLocaleString('en-IN')} plates · ${args.anpr.unreadable.toLocaleString('en-IN')} unreadable · avg edge latency ${args.anpr.latencyMs} ms.`,
    },
    {
      id: 'mix',
      tone: 'purple',
      kicker: 'Fleet mix',
      title: twoW ? `Two-wheelers ${((twoW.value / Math.max(1, args.kpis.vehicles)) * 100).toFixed(1)}%` : 'Vehicle mix',
      metric: twoW ? twoW.value.toLocaleString('en-IN') : '0',
      body: 'Two-wheeler share is elevated versus last month. Helmet-compliance events track the S.G. Highway and Iskcon Circle approaches.',
    },
  ];
}

function cameraLabel(id: CameraFilterId): string {
  if (id === 'all') return 'All cameras';
  const row = CAMERA_SEED.find((camera) => camera.code === id);
  return row ? `${row.code} · ${row.location}` : id;
}

function locationLabel(id: LocationId): string {
  return locationOptions.find((option) => option.id === id)?.label ?? 'All Gujarat';
}

export function camerasForLocation(location: LocationId): SelectOption[] {
  if (location === 'all') return cameraOptions;
  return [
    { id: 'all', label: 'All Cameras' },
    ...CAMERA_SEED.filter((camera) => camera.locationId === location).map((camera) => ({
      id: camera.code,
      label: `${camera.code} · ${camera.location}`,
    })),
  ];
}

/**
 * Pure selector used by the Analytics page. Swap for `api.getAnalytics(filters)`
 * when the command-center API is live — panel props already match this snapshot.
 */
export function computeAnalytics(filters: AnalyticsFilters): AnalyticsSnapshot {
  const { share, range, camera } = factorFor(filters);
  const vehicles = scaleInt(range.vehicles, share);
  const anpr = scaleInt(range.anpr, share);
  const events = scaleInt(range.events, share);
  const watchlist = scaleInt(range.watchlist, share);
  const camerasOnline = camera ? (camera.status === 'offline' ? 0 : 1) : filters.location === 'all' ? range.cameras : scaleInt(LOC_CAMERAS[filters.location], range.cameras / TODAY_CAMERAS);
  const fleet = camera ? 1 : filters.location === 'all' ? FLEET : scaleInt(FLEET, LOC_SHARE[filters.location]);

  const kpis = {
    vehicles,
    vehiclesDelta: range.delta,
    anpr,
    anprShare: vehicles > 0 ? (anpr / vehicles) * 100 : 0,
    events,
    eventsOpen: Math.max(0, scaleInt(23, share)),
    watchlist,
    watchlistCritical: Math.min(watchlist, scaleInt(range.watchlist === TODAY_WATCHLIST ? 2 : Math.round(range.watchlist * 0.28), share) || (watchlist > 0 ? 1 : 0)),
    cameras: camerasOnline,
    camerasPct: fleet > 0 ? (camerasOnline / fleet) * 100 : 0,
    fleet,
  };

  const unit: 'hour' | 'day' = filters.range === '7d' || filters.range === '30d' ? 'day' : 'hour';
  const vehicleTrend =
    filters.range === 'today'
      ? todayHourlyScaled(share)
      : filters.range === '24h'
        ? last24hScaled(share)
        : filters.range === '7d'
          ? weekDailyScaled(share)
          : monthDailyScaled(share);

  const typeValues = distribute(vehicles, TYPE_WEIGHTS);
  const vehicleTypes: VehicleTypeSlice[] = TYPE_META.map((meta, index) => ({ ...meta, value: typeValues[index] }));

  const eventValues = distribute(events, EVENT_WEIGHTS);
  const eventTypes: EventTypeBar[] = EVENT_META.map((meta, index) => ({ ...meta, value: eventValues[index] }));

  const anprStats = (() => {
    const processed = Math.max(anpr, scaleInt(16229 * (range.anpr / TODAY_ANPR), share));
    const unread = Math.max(0, processed - anpr);
    const [high, medium, low] = distribute(anpr, [9214, 4168, 1000]);
    return {
      processed,
      successful: anpr,
      unreadable: unread,
      confidence: Number((94.2 - (filters.location === 'surat' ? 1.4 : 0) - (camera?.status === 'offline' ? 6 : 0)).toFixed(1)),
      high,
      medium,
      low,
      latencyMs: camera?.status === 'offline' ? 0 : filters.location === 'rajkot' ? 240 : 186,
    };
  })();

  const rangeFactor = range.vehicles / TODAY_VEHICLES;
  let cameraRows: CameraActivityRow[] = CAMERA_SEED.filter((row) => {
    if (filters.location !== 'all' && row.locationId !== filters.location) return false;
    if (camera && row.code !== camera.code) return false;
    return true;
  }).map((row) => ({
    id: row.code,
    code: row.code,
    location: row.location,
    city: row.city,
    locationId: row.locationId,
    detections: scaleInt(row.detections, rangeFactor),
    events: scaleInt(row.events, rangeFactor),
    status: row.status,
  }));
  cameraRows = [...cameraRows].sort((a, b) => b.detections - a.detections);

  let locations: DetectionLocation[] = LOCATION_SEED.filter((row) => {
    if (filters.location !== 'all' && row.locationId !== filters.location) return false;
    if (camera && row.name !== camera.location) return false;
    return true;
  }).map((row) => ({
    id: row.id,
    rank: 0,
    name: row.name,
    city: row.city,
    locationId: row.locationId,
    detections: scaleInt(row.detections, rangeFactor),
    share: 0,
    trend: row.trend,
    peak: row.peak,
  }));
  locations = [...locations]
    .sort((a, b) => b.detections - a.detections)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const locTotal = locations.reduce((acc, row) => acc + row.detections, 0) || 1;
  locations = locations.map((row) => ({ ...row, share: (row.detections / locTotal) * 100 }));

  const unusual = UNUSUAL_SEED.filter((event) => {
    if (filters.location !== 'all' && event.locationId !== filters.location) return false;
    if (camera && event.camera !== camera.code) return false;
    return true;
  });

  const windowNote = RANGE_NOTE[filters.range];
  const insights = buildInsights({
    trend: vehicleTrend,
    unit,
    locations,
    events: eventTypes,
    anpr: anprStats,
    kpis,
    types: vehicleTypes,
    windowNote,
  });

  const peak = peakOf(vehicleTrend);

  return {
    filters,
    rangeLabel: RANGE_LABEL[filters.range],
    locationLabel: locationLabel(filters.location),
    cameraLabel: cameraLabel(filters.camera),
    windowNote,
    generatedAt: ANALYTICS_AS_OF,
    kpis,
    vehicleTrend,
    vehicleTrendUnit: unit,
    vehicleTypes,
    eventTypes,
    anpr: anprStats,
    cameras: cameraRows,
    locations: locations.slice(0, 6),
    watchlistTrend: watchlistSeries(filters, share),
    heatmap: buildHeatmap(share),
    insights,
    unusual,
    peakLabel: peak.label,
    peakValue: peak.value,
  };
}

export const defaultAnalyticsFilters: AnalyticsFilters = {
  range: 'today',
  location: 'all',
  camera: 'all',
};
