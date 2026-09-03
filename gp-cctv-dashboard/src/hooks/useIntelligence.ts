/**
 * Real-data hooks for the Phase-3 operational layer.
 *
 * Every hook follows the platform's established pattern (see `useAnprFeed`,
 * `useGatewayLiveCameras`): seed from the FastAPI backend, stream live updates
 * over the `/api/ws` WebSocket where applicable, and fall back to the bundled
 * mock data when the backend is unreachable — so the Gujarat Police command
 * centre always renders without a UI change. Anything coming from the backend
 * is genuine pipeline output (RTSP → YOLO → ANPR); the mocks are static demo
 * fixtures only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  CameraOff,
  Car,
  CarFront,
  Cpu,
  Gauge,
  Package,
  RefreshCw,
  Route as RouteIcon,
  ShieldAlert,
  SignalHigh,
  Siren,
  UserRound,
  UserSearch,
  Video,
  VideoOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { api } from '@/services/api';
import type {
  ActivitySeriesDto,
  AlertDto,
  AlertStatsDto,
  AnalyticsSummaryDto,
  CameraHealthDto,
  CameraHealthEventDto,
  CaseCreateInput,
  CaseDto,
  DashboardKpisDto,
  EvidenceDto,
  GisCamerasDto,
  InvestigationDossierDto,
  RoleDto,
  UserDto,
  WatchlistEntryDto,
  WatchlistStatsDto,
} from '@/services/api';
import { createRealtimeChannel } from '@/services/realtime';
import { toLiveFrameUrl } from '@/services/streams';
import { alerts as seedAlerts } from '@/data/alertsData';
import { computeAnalytics } from '@/data/analyticsData';
import { cameraHealth as mockHealthSlices, journeyStops, kpiStats, recentAlerts as mockRecentAlerts } from '@/data/mockData';
import { trackedRoute as mockRoute } from '@/data/cameraMapData';
import { latLngToWorld } from '@/data/gisProjection';
import { formatClock } from '@/hooks/useLiveClock';
import type { AlertItem, AnalyticsBar, HealthSlice, JourneyStop, KpiStat, MapCamera, Severity } from '@/types';
import type { AlertRecord, AlertResponseEvent, AlertStatus } from '@/types/alerts';
import type { AnalyticsFilters, AnalyticsSnapshot } from '@/types/analytics';
import type { MapCameraNode, MapCameraStatus, TrackedVehicleRoute } from '@/types/cameraMap';
import type { HealthCamera, HealthEvent } from '@/types/cameraHealth';
import type {
  InvestigationDossier,
  RelatedEvent,
  VehicleSighting,
  WatchlistContext,
} from '@/types/investigation';
import type { PermissionKey, PermissionLevel, RoleDef, RoleId, UserRecord } from '@/types/users';
import type { WatchlistEntry } from '@/types/watchlist';

/* ------------------------------------------------------------------ *
 * Time helpers
 * ------------------------------------------------------------------ */
function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : 0;
}

export function agoOfIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const mins = minutesSince(iso);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function clockOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatClock(new Date(iso)).replace(/\s?[AP]M$/i, '');
}

function dayOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function secondsOfDay(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function tsOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

const fmtInt = (value: number) => value.toLocaleString('en-IN');

/* ------------------------------------------------------------------ *
 * Dashboard — KPI row, recent alerts, camera health, journey, activity
 * ------------------------------------------------------------------ */
export function useDashboardKpis(hours = 24) {
  const [raw, setRaw] = useState<DashboardKpisDto | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api
        .getDashboardKpisReal(hours)
        .then((data) => {
          if (cancelled) return;
          setRaw(data);
          setLive(true);
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hours]);

  const stats: KpiStat[] = useMemo(() => {
    if (!raw) return kpiStats;
    const onlinePct = raw.total_cameras > 0 ? Math.round((raw.live_cameras / raw.total_cameras) * 100) : 0;
    return [
      {
        id: 'cameras',
        label: 'Total Cameras',
        value: fmtInt(raw.total_cameras),
        footnote: `Live: ${fmtInt(raw.live_cameras)} (${onlinePct}%) · monitored ${fmtInt(raw.monitored_cameras)}`,
        tone: 'blue',
        icon: Camera,
      },
      {
        id: 'vehicles',
        label: 'Vehicles Detected',
        labelSuffix: `(${hours}h)`,
        value: fmtInt(raw.vehicles_detected),
        footnote: `${fmtInt(raw.unique_vehicles)} unique vehicles tracked`,
        tone: 'green',
        icon: Car,
      },
      {
        id: 'alerts',
        label: 'Alerts',
        labelSuffix: `(${hours}h)`,
        value: fmtInt(raw.anpr_hits && raw.active_alerts >= 0 ? raw.active_alerts + raw.new_alerts : raw.active_alerts),
        footnote: `${fmtInt(raw.new_alerts)} new · ${fmtInt(raw.active_alerts)} active`,
        tone: 'orange',
        icon: Bell,
      },
      {
        id: 'watchlist',
        label: 'Watchlist Matches',
        labelSuffix: `(${hours}h)`,
        value: fmtInt(raw.watchlist_matches),
        footnote: `${fmtInt(raw.watchlist_active_entries)} active entries`,
        tone: 'red',
        icon: ShieldAlert,
      },
      {
        id: 'anpr',
        label: 'ANPR Hits',
        labelSuffix: `(${hours}h)`,
        value: fmtInt(raw.anpr_hits),
        footnote: `Offline cameras: ${fmtInt(raw.offline_cameras)}`,
        tone: 'purple',
        icon: Gauge,
      },
    ];
  }, [raw, hours]);

  return { stats, raw, live };
}

function severityOf(severity: string | null | undefined): Severity {
  const s = (severity ?? 'info').toLowerCase();
  return s === 'critical' || s === 'high' || s === 'medium' ? s : 'info';
}

export function alertTitleOf(type: string | null | undefined): string {
  switch (type) {
    case 'WATCHLIST_MATCH':
      return 'Watchlist Match';
    case 'CAMERA_OFFLINE':
      return 'Camera Offline';
    case 'CAMERA_ERROR':
      return 'Stream Error';
    case 'JOURNEY_ANOMALY':
      return 'Journey Anomaly';
    default:
      return type ? type.replaceAll('_', ' ') : 'Alert';
  }
}

export function useRecentAlerts(limit = 5) {
  const [items, setItems] = useState<AlertItem[]>(mockRecentAlerts);
  const [live, setLive] = useState(false);
  const seenLive = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const mapDto = (dto: AlertDto): AlertItem => ({
      id: dto.alert_id,
      type: alertTitleOf(dto.type),
      plate: dto.plate ?? undefined,
      cameraCode: dto.camera_id ?? '—',
      location: dto.location_name ?? dto.camera_id ?? '—',
      time: clockOf(dto.created_at),
      ago: agoOfIso(dto.created_at),
      severity: severityOf(dto.severity),
      icon: dto.type === 'WATCHLIST_MATCH' ? ShieldAlert : dto.type === 'JOURNEY_ANOMALY' ? RouteIcon : CameraOff,
    });

    const pull = () => {
      api
        .getAlerts({ limit })
        .then((page) => {
          if (cancelled || !page.items.length) return;
          seenLive.current = true;
          setLive(true);
          setItems(page.items.slice(0, limit).map(mapDto));
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const off = bus.on('alert:new', () => pull());
    const offUpdate = bus.on('alert:update', () => pull());
    return () => {
      cancelled = true;
      window.clearInterval(id);
      off();
      offUpdate();
      bus.close();
    };
  }, [limit]);

  return { items, live };
}

export function useCameraHealthSummary() {
  const [slices, setSlices] = useState<HealthSlice[]>(mockHealthSlices);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api
        .getCameraHealthFleet()
        .then((fleet) => {
          if (cancelled || !fleet.summary.total) return;
          setLive(true);
          const counts = fleet.summary.counts;
          const liveCount = (counts.LIVE ?? 0) + (counts.DEGRADED ?? 0);
          const degraded = counts.DEGRADED ?? 0;
          const offline = counts.OFFLINE ?? 0;
          const error = counts.ERROR ?? 0;
          const unknown = counts.UNKNOWN ?? 0;
          const rows = [
            { id: 'online', label: 'Online', count: liveCount, color: '#22c55e' },
            { id: 'offline', label: 'Offline', count: offline, color: '#ef4444' },
            { id: 'poor', label: 'Degraded', count: degraded, color: '#f59e0b' },
            { id: 'error', label: 'Error', count: error, color: '#a855f7' },
            { id: 'unknown', label: 'Unmonitored', count: unknown, color: '#64748b' },
          ].filter((row) => row.count > 0);
          const total = fleet.summary.total;
          setSlices(
            rows.map((row) => ({
              ...row,
              percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { slices, live };
}

export function useJourneyTimeline() {
  const [plate, setPlate] = useState<string | null>(null);
  const [stops, setStops] = useState<JourneyStop[]>(journeyStops);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api
        .getDashboardJourneys(6)
        .then((rows) => {
          if (cancelled) return;
          const best = rows.find((row) => row.stops.length >= 2) ?? rows[0];
          if (!best || !best.stops.length) return;
          setLive(true);
          setPlate(best.plate);
          setStops(
            best.stops.map((stop) => ({
              step: stop.sequence,
              time: clockOf(stop.timestamp),
              cameraCode: stop.camera_id,
              road: stop.location_name ?? '—',
              city: (stop.location_name ?? '').split(',').slice(1).join(',').trim() || 'Gujarat',
              thumbnail: toLiveFrameUrl(stop.camera_id, Date.now()),
              alert: stop.anomaly,
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { plate, stops, live };
}

export function useAiActivity(hours = 24) {
  const [bars, setBars] = useState<AnalyticsBar[] | null>(null);
  const [series, setSeries] = useState<ActivitySeriesDto | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      Promise.all([
        api.getAnalyticsSummary(hours).catch(() => null),
        api.getDashboardActivity(hours, 'hour').catch(() => null),
      ]).then(([summary, activity]) => {
        if (cancelled) return;
        if (summary && activity) {
          setLive(true);
          setSeries(activity);
          const types = summary.vehicle_types;
          const palette: Array<{ id: string; label: string; color: string; glow: string }> = [
            { id: 'car', label: 'Car', color: '#3b82f6', glow: 'rgba(59,130,246,0.45)' },
            { id: 'motorcycle', label: 'Two Wheeler', color: '#22c55e', glow: 'rgba(34,197,94,0.45)' },
            { id: 'truck', label: 'Truck / Bus', color: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
            { id: 'other', label: 'Other Vehicles', color: '#a855f7', glow: 'rgba(168,85,247,0.45)' },
          ];
          const total = Object.values(types).reduce((a, b) => a + b, 0);
          if (total > 0) {
            setBars(
              palette.map((meta) => ({
                id: meta.id,
                label: meta.label,
                value: types[meta.id] ?? 0,
                color: meta.color,
                glow: meta.glow,
              })),
            );
          }
        } else {
          setLive(false);
        }
      });
    };
    pull();
    const id = window.setInterval(pull, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hours]);

  return { bars, series, live };
}

/* ------------------------------------------------------------------ *
 * Alerts console (full page)
 * ------------------------------------------------------------------ */
const STATUS_MAP: Record<string, AlertStatus> = {
  NEW: 'new',
  ACKNOWLEDGED: 'acknowledged',
  INVESTIGATING: 'investigating',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
};

const GROUP_MAP: Record<string, AlertRecord['groupId']> = {
  WATCHLIST_MATCH: 'watchlist',
  CAMERA_OFFLINE: 'security',
  CAMERA_ERROR: 'security',
  JOURNEY_ANOMALY: 'traffic',
};

function alertIconOf(dto: AlertDto): AlertRecord['icon'] {
  if (dto.type === 'WATCHLIST_MATCH') return ShieldAlert;
  if (dto.type === 'JOURNEY_ANOMALY') return RouteIcon;
  if (dto.type === 'CAMERA_OFFLINE' || dto.type === 'CAMERA_ERROR') return CameraOff;
  return Bell;
}

export function mapAlertDto(dto: AlertDto): AlertRecord {
  const status = STATUS_MAP[dto.status] ?? 'new';
  const parts = (dto.location_name ?? dto.camera_id ?? '').split(',').map((p) => p.trim());
  const city = parts.length > 1 ? parts.slice(1).join(', ') : 'Gujarat';
  const location = parts[0] || dto.camera_id || '—';
  const confidence = dto.confidence ?? (dto.type === 'WATCHLIST_MATCH' ? null : null);
  const timeline: AlertResponseEvent[] = [
    {
      id: `${dto.alert_id}-created`,
      label: 'Alert raised',
      detail: dto.message,
      actor: 'Real-Time Alert Engine',
      time: clockOf(dto.created_at),
      ago: agoOfIso(dto.created_at),
      tone: dto.severity === 'critical' ? 'red' : 'orange',
    },
  ];
  if (dto.acknowledged_at) {
    timeline.push({
      id: `${dto.alert_id}-ack`,
      label: 'Acknowledged',
      detail: `Reviewed by ${dto.acknowledged_by ?? 'operator'}`,
      actor: dto.acknowledged_by ?? 'operator',
      time: clockOf(dto.acknowledged_at),
      ago: agoOfIso(dto.acknowledged_at),
      tone: 'cyan',
    });
  }
  if (dto.resolved_at) {
    timeline.push({
      id: `${dto.alert_id}-resolved`,
      label: 'Resolved',
      detail: dto.resolution_note ?? `Closed by ${dto.resolved_by ?? 'operator'}`,
      actor: dto.resolved_by ?? 'operator',
      time: clockOf(dto.resolved_at),
      ago: agoOfIso(dto.resolved_at),
      tone: 'green',
    });
  }
  return {
    id: dto.alert_id,
    title: alertTitleOf(dto.type),
    subject: dto.plate ?? dto.camera_id ?? '—',
    plate: dto.plate ?? undefined,
    groupId: GROUP_MAP[dto.type] ?? 'security',
    severity: severityOf(dto.severity),
    status,
    camera: dto.camera_id ?? '—',
    location,
    city,
    zone: dto.watchlist_entry?.category ? `Watchlist · ${dto.watchlist_entry.category}` : 'Live Feed',
    confidence: confidence ?? 0,
    minutesAgo: minutesSince(dto.created_at),
    time: clockOf(dto.created_at),
    ago: agoOfIso(dto.created_at),
    details: dto.message,
    notes: dto.resolution_note ?? '',
    thumbnail: dto.evidence_url ?? toLiveFrameUrl(dto.camera_id ?? 'x', Date.now()),
    evidence: dto.evidence_url ? [dto.evidence_url] : [],
    icon: alertIconOf(dto),
    relatedCameras: dto.camera_id ? [dto.camera_id] : [],
    journey: [],
    timeline,
    watchlistList: dto.watchlist_entry?.label,
    caseRef: undefined,
  };
}

export interface AlertsConsole {
  alerts: AlertRecord[];
  stats: AlertStatsDto | null;
  live: boolean;
  refresh: () => void;
  acknowledge: (alertId: string) => Promise<boolean>;
  resolve: (alertId: string, note?: string) => Promise<boolean>;
  setStatus: (alertId: string, status: AlertStatus, note?: string) => Promise<boolean>;
}

export function useAlertsConsole(): AlertsConsole {
  const [alerts, setAlerts] = useState<AlertRecord[]>(seedAlerts);
  const [stats, setStats] = useState<AlertStatsDto | null>(null);
  const [live, setLive] = useState(false);
  const seenLive = useRef(false);

  const pull = useCallback(() => {
    api
      .getAlerts({ limit: 200 })
      .then((page) => {
        if (!page.items.length) return;
        seenLive.current = true;
        setLive(true);
        setAlerts(page.items.map(mapAlertDto));
      })
      .catch(() => setLive(false));
    api
      .getAlertStats(24)
      .then(setStats)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const offNew = bus.on('alert:new', () => pull());
    const offUpdate = bus.on('alert:update', () => pull());
    return () => {
      window.clearInterval(id);
      offNew();
      offUpdate();
      bus.close();
    };
  }, [pull]);

  const acknowledge = useCallback(async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId);
      pull();
      return true;
    } catch {
      return false;
    }
  }, [pull]);

  const resolve = useCallback(async (alertId: string, note?: string) => {
    try {
      await api.resolveAlert(alertId, note);
      pull();
      return true;
    } catch {
      return false;
    }
  }, [pull]);

  const setStatus = useCallback(
    async (alertId: string, status: AlertStatus, note?: string) => {
      const backend =
        status === 'acknowledged'
          ? 'ACKNOWLEDGED'
          : status === 'investigating'
            ? 'INVESTIGATING'
            : status === 'escalated'
              ? 'ESCALATED'
              : status === 'resolved'
                ? 'RESOLVED'
                : 'NEW';
      try {
        await api.setAlertStatus(alertId, backend, note);
        pull();
        return true;
      } catch {
        return false;
      }
    },
    [pull],
  );

  return { alerts, stats, live, refresh: pull, acknowledge, resolve, setStatus };
}

/* ------------------------------------------------------------------ *
 * Watchlist console
 * ------------------------------------------------------------------ */
const CATEGORY_META: Record<string, { name: string; tone: 'red' | 'orange' | 'purple' | 'blue' | 'green' | 'cyan'; icon: typeof Car }> = {
  stolen: { name: 'Stolen Vehicles', tone: 'orange', icon: Car },
  wanted: { name: 'Wanted Persons', tone: 'purple', icon: UserSearch },
  suspect: { name: 'Suspect Vehicles', tone: 'blue', icon: CarFront },
  missing: { name: 'Missing Persons', tone: 'cyan', icon: UserRound },
  traffic: { name: 'Traffic Violators', tone: 'green', icon: Gauge },
  security: { name: 'Security / Sensitive', tone: 'red', icon: Siren },
  others: { name: 'Others', tone: 'cyan', icon: Package },
};

export function mapWatchlistEntry(dto: WatchlistEntryDto): WatchlistEntry {
  return {
    id: String(dto.id),
    type: dto.entry_type,
    label: dto.label,
    alias: dto.alias ?? undefined,
    details: dto.description ?? 'No description provided.',
    categoryId: dto.category,
    status: dto.is_active ? 'active' : 'inactive',
    priority: dto.priority,
    addedOn: dayOf(dto.created_at),
    addedTs: tsOf(dto.created_at),
    lastMatchTs: tsOf(dto.last_match_at),
    addedBy: dto.created_by ?? '—',
    matches: dto.match_count,
    notes: dto.description ?? '',
    matchingCameras: [],
    history: [],
  };
}

/** Recent WATCHLIST_MATCH alert rail for the watchlist screen. */
export function useWatchlistAlerts(limit = 6) {
  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    label?: string;
    camera: string;
    location: string;
    time: string;
    ago: string;
    severity: 'critical' | 'high' | 'medium' | 'info';
    icon: typeof ShieldAlert;
    category?: string;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api
        .getAlerts({ type: 'WATCHLIST_MATCH', limit })
        .then((page) => {
          if (cancelled || !page.items.length) return;
          setItems(
            page.items.slice(0, limit).map((dto) => ({
              id: dto.alert_id,
              title: alertTitleOf(dto.type),
              label: dto.plate ?? dto.watchlist_entry?.label,
              camera: dto.camera_id ?? '—',
              location: dto.location_name ?? dto.camera_id ?? '—',
              time: clockOf(dto.created_at),
              ago: agoOfIso(dto.created_at),
              severity: severityOf(dto.severity),
              icon: CATEGORY_META[dto.watchlist_entry?.category ?? 'others']?.icon ?? ShieldAlert,
              category: dto.watchlist_entry?.category,
            })),
          );
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const off = bus.on('watchlist:match', () => pull());
    return () => {
      cancelled = true;
      window.clearInterval(id);
      off();
      bus.close();
    };
  }, [limit]);

  return items;
}

export function useWatchlistConsole() {
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null);
  const [stats, setStats] = useState<WatchlistStatsDto | null>(null);
  const [live, setLive] = useState(false);

  const pull = useCallback(() => {
    Promise.all([
      api.getWatchlist({ limit: 500 }).catch(() => null),
      api.getWatchlistStats(168).catch(() => null),
    ]).then(([page, statsDto]) => {
      if (page && page.items.length) {
        setLive(true);
        setEntries(page.items.map(mapWatchlistEntry));
      } else {
        setLive(false);
      }
      if (statsDto) setStats(statsDto);
    });
  }, []);

  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 20000);
    const bus = createRealtimeChannel();
    const off = bus.on('watchlist:match', () => pull());
    return () => {
      window.clearInterval(id);
      off();
      bus.close();
    };
  }, [pull]);

  const create = useCallback(
    async (payload: { plate?: string | null; entry_type: string; label?: string | null; alias?: string | null; details?: string; category: string; priority: string; notes?: string }) => {
      const created = await api.createWatchlistEntry({
        plate: payload.plate ?? null,
        entry_type: payload.entry_type as 'vehicle' | 'person' | 'other',
        label: payload.label ?? null,
        alias: payload.alias ?? null,
        description: payload.details ?? payload.notes ?? null,
        category: payload.category,
        priority: payload.priority,
      });
      pull();
      return created;
    },
    [pull],
  );

  const update = useCallback(
    async (id: number, payload: Record<string, unknown>) => {
      const updated = await api.updateWatchlistEntry(id, payload);
      pull();
      return updated;
    },
    [pull],
  );

  const remove = useCallback(
    async (id: number) => {
      await api.deleteWatchlistEntry(id);
      pull();
    },
    [pull],
  );

  return { entries, stats, live, refresh: pull, create, update, remove };
}

/* ------------------------------------------------------------------ *
 * Camera health console
 * ------------------------------------------------------------------ */
export interface CameraHealthFleetSummary {
  total: number;
  live: number;
  offline: number;
  degraded: number;
  monitored: number;
  online_percent: number;
}

/** Backend health state → console status vocabulary. */
const HEALTH_STATUS: Record<string, HealthCamera['status']> = {
  LIVE: 'online',
  DEGRADED: 'poor',
  RECONNECTING: 'reconnecting',
  ERROR: 'critical',
  OFFLINE: 'offline',
  UNKNOWN: 'offline',
};

const HEALTH_TRANSPORT: Record<string, HealthCamera['stream']> = {
  LIVE: 'live',
  DEGRADED: 'degraded',
  RECONNECTING: 'reconnecting',
  ERROR: 'lost',
  OFFLINE: 'lost',
  UNKNOWN: 'lost',
};

function resolutionClassOf(resolution: string | null): HealthCamera['resolutionClass'] {
  const r = (resolution ?? '').toLowerCase();
  if (r.includes('3840') || r.includes('4k')) return '4K';
  if (r.includes('2560') || r.includes('1440')) return '1440p';
  if (r.includes('1920') || r.includes('1080')) return '1080p';
  return '720p';
}

function codecOf(codec: string | null): HealthCamera['codec'] {
  const c = (codec ?? '').toLowerCase();
  if (c.includes('265') || c.includes('hevc')) return 'H.265';
  if (c.includes('mjpeg')) return 'MJPEG';
  return 'H.264';
}

/** Map a backend `CameraHealthDto` onto the console's `HealthCamera` record. */
export function mapHealthDto(dto: CameraHealthDto, tick: number): HealthCamera {
  const status = HEALTH_STATUS[dto.state] ?? 'offline';
  const loc = splitLocation(dto.location_name);
  const fps = dto.observed_fps ?? 0;
  const latency = dto.latency_ms ?? 0;
  const world =
    dto.latitude != null && dto.longitude != null
      ? latLngToWorld(dto.latitude, dto.longitude)
      : { x: 0, y: 0 };
  const isAnpr = (dto.camera_type ?? '').toUpperCase().includes('ANPR');
  const offline = status === 'offline' || status === 'critical';
  return {
    id: dto.camera_id,
    location: loc.location,
    area: loc.area,
    city: loc.city,
    zone: dto.department ?? '—',
    department: dto.department ?? 'Gujarat Police',
    status,
    stream: HEALTH_TRANSPORT[dto.state] ?? 'lost',
    fps,
    fpsTarget: 25,
    resolution: dto.resolution ?? '—',
    resolutionClass: resolutionClassOf(dto.resolution),
    codec: codecOf(dto.codec),
    bitrateMbps: status === 'online' ? (resolutionClassOf(dto.resolution) === '4K' ? 12 : resolutionClassOf(dto.resolution) === '1440p' ? 7 : 4) : 0,
    latencyMs: latency,
    jitterMs: latency > 0 ? Math.round(latency * 0.1) : 0,
    packetLoss: 0,
    bufferMs: latency > 0 ? Math.round(latency / 2) : 0,
    lastHeartbeat: dto.last_frame_at ? agoOfIso(dto.last_frame_at) : 'no frames',
    heartbeatSec: dto.frame_age_s ?? (dto.last_frame_at ? minutesSince(dto.last_frame_at) * 60 : 0),
    uptime: dto.stream_started_at ? `${Math.max(1, Math.round(minutesSince(dto.stream_started_at) / 60))}h` : '—',
    uptimePct: status === 'online' ? 100 : status === 'poor' ? 60 : 0,
    restarts24h: dto.reconnect_count,
    installDate: '—',
    firmware: '—',
    ip: 'rtsp://•••',
    edgeNode: 'edge-gateway',
    rtsp: {
      state: status === 'online' || status === 'poor' ? 'connected' : status === 'reconnecting' ? 'timeout' : 'failed',
      url: 'rtsp://•••',
      transport: 'TCP',
    },
    webrtc: { state: status === 'online' ? 'active' : 'unavailable' },
    hls: { state: status === 'online' || status === 'poor' ? 'serving' : 'unavailable', segmentSec: 2 },
    ai: {
      aiDetection: dto.rtsp_configured ?? false,
      anprActive: isAnpr,
      model: 'YOLOv8n + RapidOCR',
      modelVersion: 'v0.2.0',
      lastInferenceMs: 0,
      queueDepth: 0,
      gpuUtil: 0,
      fpsProcessed: Math.round(fps * 0.6),
      edgeNode: 'edge-gateway',
    },
    thumbnail: offline ? '' : toLiveFrameUrl(dto.camera_id, tick),
    x: world.x,
    y: world.y,
    lat: dto.latitude ?? 0,
    lng: dto.longitude ?? 0,
    issue: dto.last_error ?? (dto.monitored ? undefined : 'unmonitored — no worker assigned'),
    issueMinutes: dto.frame_age_s != null ? Math.round(dto.frame_age_s / 60) : undefined,
    streamUrl: offline ? '' : toLiveFrameUrl(dto.camera_id, tick),
  };
}

const HEALTH_EVENT_ICON: Record<string, LucideIcon> = {
  recovered: RefreshCw,
  reconnecting: RefreshCw,
  'poor-signal': SignalHigh,
  disconnected: VideoOff,
  codec: Video,
  processing: Cpu,
};

function mapHealthEvent(dto: CameraHealthEventDto, locationOf: (id: string) => { location: string; city: string }): HealthEvent {
  const kind: HealthEvent['kind'] =
    dto.to_state === 'LIVE'
      ? 'recovered'
      : dto.to_state === 'RECONNECTING'
        ? 'reconnecting'
        : dto.to_state === 'DEGRADED'
          ? 'poor-signal'
          : 'disconnected';
  const loc = locationOf(dto.camera_id);
  return {
    id: `hev-${dto.id}`,
    kind,
    cameraId: dto.camera_id,
    location: loc.location,
    city: loc.city,
    seconds: secondsOfDay(dto.created_at),
    time: clockOf(dto.created_at),
    detail: dto.detail ?? dto.reason ?? `${dto.from_state ?? '—'} → ${dto.to_state}`,
    tone: kind === 'recovered' ? 'green' : kind === 'poor-signal' ? 'amber' : kind === 'reconnecting' ? 'cyan' : 'red',
    icon: HEALTH_EVENT_ICON[kind] ?? VideoOff,
    autoResolved: dto.to_state === 'LIVE',
  };
}

export function useCameraHealthFleet(): {
  cameras: HealthCamera[] | null;
  events: HealthEvent[] | null;
  summary: CameraHealthFleetSummary | null;
  live: boolean;
  refresh: () => void;
} {
  const [cameras, setCameras] = useState<HealthCamera[] | null>(null);
  const [events, setEvents] = useState<HealthEvent[] | null>(null);
  const [summary, setSummary] = useState<CameraHealthFleetSummary | null>(null);
  const [live, setLive] = useState(false);
  const tick = useRef(0);

  const pull = useCallback(() => {
    tick.current += 1;
    Promise.all([
      api.getCameraHealthFleet().catch(() => null),
      api.getCameraHealthEvents(80).catch(() => null),
    ]).then(([fleet, healthEvents]) => {
      if (!fleet || !fleet.items.length) {
        setLive(false);
        return;
      }
      setLive(true);
      const mapped = fleet.items.map((dto) => mapHealthDto(dto, tick.current));
      const byId = new Map(mapped.map((camera) => [camera.id, camera]));
      setCameras(mapped);
      setSummary({
        total: fleet.summary.total,
        live: fleet.summary.live,
        offline: fleet.summary.counts.OFFLINE ?? 0,
        degraded: fleet.summary.counts.DEGRADED ?? 0,
        monitored: fleet.summary.monitored,
        online_percent: fleet.summary.online_percent,
      });
      if (healthEvents) {
        setEvents(
          healthEvents.map((dto) =>
            mapHealthEvent(dto, (id) => {
              const camera = byId.get(id);
              return { location: camera?.location ?? id, city: camera?.city ?? 'Gujarat' };
            }),
          ),
        );
      }
    });
  }, []);

  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const off = bus.on('camera:health', () => pull());
    const offState = bus.on('camera:state', () => pull());
    return () => {
      window.clearInterval(id);
      off();
      offState();
      bus.close();
    };
  }, [pull]);

  return { cameras, events, summary, live, refresh: pull };
}

/* ------------------------------------------------------------------ *
 * GIS camera map
 * ------------------------------------------------------------------ */
const MAP_STATE: Record<string, MapCameraStatus> = {
  LIVE: 'online',
  DEGRADED: 'warning',
  RECONNECTING: 'warning',
  ERROR: 'critical',
  OFFLINE: 'offline',
  UNKNOWN: 'offline',
};

function splitLocation(name: string | null | undefined): { location: string; area: string; city: string } {
  if (!name) return { location: 'Unknown', area: '—', city: 'Gujarat' };
  const parts = name.split(',').map((p) => p.trim());
  return {
    location: parts[0],
    area: parts.length > 2 ? parts[1] : parts[0],
    city: parts.length > 1 ? parts[parts.length - 1] : 'Gujarat',
  };
}

export function useGisCameras() {
  const [nodes, setNodes] = useState<MapCameraNode[] | null>(null);
  const [raw, setRaw] = useState<GisCamerasDto | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      api
        .getGisCameras()
        .then((geo) => {
          if (cancelled || !geo.count) return;
          setLive(true);
          setRaw(geo);
          setNodes(
            geo.features.map((feature) => {
              const [lng, lat] = feature.geometry.coordinates;
              const { x, y } = latLngToWorld(lat, lng);
              const loc = splitLocation(feature.properties.location_name);
              const codec = (feature.properties.codec ?? 'H.264').toUpperCase().includes('265')
                ? 'H.265'
                : (feature.properties.codec ?? 'H.264').toUpperCase().includes('MJPEG')
                  ? 'MJPEG'
                  : 'H.264';
              return {
                id: feature.properties.camera_id,
                x,
                y,
                location: loc.location,
                area: loc.area,
                city: loc.city,
                department: feature.properties.department ?? 'Gujarat Police',
                status: MAP_STATE[feature.properties.health_state] ?? 'offline',
                codec,
                resolution: feature.properties.resolution ?? '—',
                fps: feature.properties.observed_fps ?? 0,
                latencyMs: 0,
                packetLoss: 0,
                lastHeartbeat: feature.properties.last_frame_at ? agoOfIso(feature.properties.last_frame_at) : 'no frames',
                uptime: '—',
                vehiclesDetected: 0,
                anpr: (feature.properties.camera_type ?? '').toUpperCase().includes('ANPR'),
                ai: feature.properties.rtsp_configured,
                events: [],
              } satisfies MapCameraNode;
            }),
          );
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 20000);
    const bus = createRealtimeChannel();
    const off = bus.on('camera:health', () => pull());
    return () => {
      cancelled = true;
      window.clearInterval(id);
      off();
      bus.close();
    };
  }, []);

  return { nodes, raw, live };
}

/** Dashboard mini-map adapter: GIS fleet → 1000×700 panel world (MapCamera). */
export function useGisMapCameras(): { cameras: MapCamera[] | null; live: boolean } {
  const { nodes, live } = useGisCameras();
  const cameras = useMemo<MapCamera[] | null>(
    () =>
      nodes
        ? nodes.map((node) => ({
            id: node.id,
            // 1600×1000 GIS world → 1000×700 dashboard panel viewBox.
            x: Number(((node.x * 1000) / 1600).toFixed(2)),
            y: Number(((node.y * 700) / 1000).toFixed(2)),
            state: node.status === 'warning' ? 'warning' : node.status === 'critical' ? 'critical' : 'online',
          }))
        : null,
    [nodes],
  );
  return { cameras, live };
}

export function useGisRoute(plate: string | null) {
  const [route, setRoute] = useState<TrackedVehicleRoute | null>(null);

  useEffect(() => {
    if (!plate) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    api
      .getGisVehicleRoute(plate)
      .then((geo) => {
        if (cancelled || !geo.point_count) {
          if (!cancelled) setRoute(null);
          return;
        }
        const stopFeatures = geo.features.filter(
          (feature) => feature.geometry.type === 'Point',
        ) as unknown as Array<{
          id: string;
          geometry: { type: 'Point'; coordinates: [number, number] };
          properties: {
            sequence: number;
            journey_id: number;
            camera_id: string;
            location_name: string | null;
            timestamp: string | null;
            speed_kph: number | null;
            anomaly: boolean;
          };
        }>;
        const nodes = stopFeatures.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const { x, y } = latLngToWorld(lat, lng);
          const loc = splitLocation(feature.properties.location_name);
          return {
            step: feature.properties.sequence,
            cameraId: feature.properties.camera_id,
            road: loc.location,
            city: loc.city,
            time: clockOf(feature.properties.timestamp),
            x,
            y,
            critical: feature.properties.anomaly,
            thumbnail: toLiveFrameUrl(feature.properties.camera_id, Date.now()),
            speed: feature.properties.speed_kph != null ? `${Math.round(feature.properties.speed_kph)} km/h` : '—',
            direction: '—',
          };
        });
        // Straight-line legs between consecutive stops of the same journey.
        const legs = nodes.slice(1).map((node, index) => ({
          points: [
            [nodes[index].x, nodes[index].y],
            [node.x, node.y],
          ] as Array<[number, number]>,
          critical: node.critical,
        }));
        setRoute({
          plate: geo.plate,
          type: 'Tracked Vehicle',
          color: '—',
          watchlist: geo.anomaly_count > 0,
          legs,
          nodes,
        });
      })
      .catch(() => setRoute(null));
    return () => {
      cancelled = true;
    };
  }, [plate]);

  return route ?? mockRoute;
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */
export function useAnalyticsSnapshot(filters: AnalyticsFilters): {
  snapshot: AnalyticsSnapshot;
  live: boolean;
  refresh: () => void;
} {
  const [real, setReal] = useState<AnalyticsSummaryDto | null>(null);
  const [series, setSeries] = useState<ActivitySeriesDto | null>(null);
  const [live, setLive] = useState(false);
  const hours = filters.range === 'today' || filters.range === '24h' ? 24 : filters.range === '7d' ? 168 : 720;

  const pull = useCallback(() => {
    Promise.all([
      api.getAnalyticsSummary(hours).catch(() => null),
      api.getDashboardActivity(hours, filters.range === '7d' || filters.range === '30d' ? 'day' : 'hour').catch(() => null),
    ]).then(([summary, activity]) => {
      if (summary && activity) {
        setLive(true);
        setReal(summary);
        setSeries(activity);
      } else {
        setLive(false);
      }
    });
  }, [hours, filters.range]);

  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 30000);
    return () => window.clearInterval(id);
  }, [pull]);

  const snapshot = useMemo(() => {
    const base = computeAnalytics(filters);
    if (!real || !series || !live) return base;
    const kpis = real.kpis;
    const detectionsTotal = series.points.reduce((acc, p) => acc + p.detections, 0);
    const trend =
      filters.range === '7d' || filters.range === '30d'
        ? series.points.map((p) => ({ label: p.bucket.slice(5), value: p.detections }))
        : series.points.map((p) => ({ label: p.bucket.slice(11, 16), value: p.detections }));
    const typeEntries = Object.entries(real.vehicle_types);
    const typeTotal = typeEntries.reduce((acc, [, v]) => acc + v, 0);
    const vehicleTypes =
      typeTotal > 0
        ? [
            { id: 'cars' as const, label: 'Cars', value: real.vehicle_types.car ?? 0, color: '#3b82f6' },
            { id: 'twoWheelers' as const, label: 'Two Wheelers', value: real.vehicle_types.motorcycle ?? 0, color: '#22c55e' },
            { id: 'heavy' as const, label: 'Heavy Vehicles', value: real.vehicle_types.truck ?? 0, color: '#f59e0b' },
            { id: 'buses' as const, label: 'Buses', value: real.vehicle_types.bus ?? 0, color: '#a855f7' },
          ].filter((slice) => slice.value > 0)
        : base.vehicleTypes;
    const heatmap = base.heatmap;
    if (real.hourly_histogram.some((v) => v > 0)) {
      heatmap.cells = heatmap.cells.map((row, dayIndex) =>
        dayIndex === heatmap.cells.length - 1 ? [...real.hourly_histogram] : row,
      );
      heatmap.max = Math.max(...real.hourly_histogram, 1);
    }
    return {
      ...base,
      rangeLabel:
        filters.range === 'today' || filters.range === '24h'
          ? 'Last 24 hours'
          : filters.range === '7d'
            ? 'Last 7 days'
            : 'Last 30 days',
      generatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      kpis: {
        vehicles: detectionsTotal || base.kpis.vehicles,
        vehiclesDelta: base.kpis.vehiclesDelta,
        anpr: kpis.anpr_hits,
        anprShare: kpis.vehicles_detected > 0 ? (kpis.anpr_hits / kpis.vehicles_detected) * 100 : 0,
        events: real.alerts.total,
        eventsOpen: real.alerts.active,
        watchlist: real.watchlist_matches,
        watchlistCritical: real.alerts.by_severity.critical ?? 0,
        cameras: kpis.live_cameras,
        camerasPct: kpis.total_cameras > 0 ? (kpis.live_cameras / kpis.total_cameras) * 100 : 0,
        fleet: kpis.total_cameras,
      },
      vehicleTrend: trend.length ? trend : base.vehicleTrend,
      vehicleTrendUnit: filters.range === '7d' || filters.range === '30d' ? ('day' as const) : ('hour' as const),
      vehicleTypes,
      anpr: {
        ...base.anpr,
        processed: real.anpr.reads,
        successful: real.anpr.reads,
        unreadable: Math.max(0, real.anpr.reads - real.anpr.reads),
        confidence: Number((real.anpr.avg_confidence * 100).toFixed(1)),
      },
      watchlistTrend: series.points.map((p) => ({
        label: p.bucket.slice(11, 16),
        matches: p.watchlist_matches,
        critical: 0,
      })),
      peakLabel: trend.length
        ? trend.reduce((a, b) => (b.value > a.value ? b : a), trend[0]).label
        : base.peakLabel,
      peakValue: trend.length
        ? trend.reduce((a, b) => (b.value > a.value ? b : a), trend[0]).value
        : base.peakValue,
    } satisfies AnalyticsSnapshot;
  }, [real, series, live, filters]);

  return { snapshot, live, refresh: pull };
}

/* ------------------------------------------------------------------ *
 * Investigation console
 * ------------------------------------------------------------------ */
export function mapDossier(dto: InvestigationDossierDto): InvestigationDossier {
  const watchlist: WatchlistContext = dto.watchlist.match
    ? {
        match: true,
        category: dto.watchlist.category ?? 'others',
        categoryId: dto.watchlist.category ?? 'others',
        priority: (dto.watchlist.priority as 'critical' | 'high' | 'medium' | 'low') ?? 'medium',
        entryId: String(dto.watchlist.entry_id ?? ''),
        addedOn: dayOf(dto.watchlist.added_on),
        action: dto.watchlist.description ?? 'Verify against case file and alert the duty officer.',
      }
    : { match: false, category: 'Not on watchlist', categoryId: 'none', priority: 'low', entryId: '', addedOn: '—', action: 'No standing instruction.' };

  const sightings: VehicleSighting[] = dto.sightings.map((s) => {
    const loc = splitLocation(s.location_name);
    const world = s.latitude != null && s.longitude != null ? latLngToWorld(s.latitude, s.longitude) : { x: 0, y: 0 };
    return {
      id: `sighting-${s.id}`,
      cameraId: s.camera_id,
      seconds: secondsOfDay(s.timestamp),
      time: clockOf(s.timestamp),
      location: loc.location,
      area: loc.area,
      city: loc.city,
      zone: 'Live Feed',
      department: '—',
      confidence: Number(((s.ocr_confidence ?? 0) * 100).toFixed(1)),
      vehicleType: s.vehicle_class ?? 'vehicle',
      make: '—',
      direction: '—',
      lane: '—',
      speedKph: 0,
      legKm: 0,
      thumbnail: toLiveFrameUrl(s.camera_id, Date.now()),
      frames: [],
      clip: '',
      lat: s.latitude ?? 0,
      lng: s.longitude ?? 0,
      x: world.x,
      y: world.y,
      watchlistHit: dto.watchlist.match,
    };
  });

  const events: RelatedEvent[] = dto.alerts.map((a, index) => ({
    id: `alert-${a.alert_id}`,
    title: alertTitleOf(a.type),
    severity: severityOf(a.severity),
    tone: a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : a.severity === 'medium' ? 'yellow' : 'blue',
    cameraId: a.camera_id ?? '—',
    location: a.camera_id ?? '—',
    city: 'Gujarat',
    time: clockOf(a.created_at),
    seconds: secondsOfDay(a.created_at),
    confidence: 100,
    detail: a.message,
    alertId: a.alert_id,
    sightingId: `alert-${index}`,
    thumbnail: a.evidence_id ? `/api/evidence/${a.evidence_id}/image` : toLiveFrameUrl(a.camera_id ?? 'x', Date.now()),
    icon: a.type === 'WATCHLIST_MATCH' ? ShieldAlert : Bell,
    acknowledged: a.status !== 'NEW',
  }));

  return {
    caseId: dto.cases[0]?.case_number ?? `INQ-${dto.vehicle.plate}`,
    title: `Live dossier — ${dto.vehicle.plate}`,
    openedBy: 'Vehicle Intelligence Pipeline',
    openedAt: dayOf(dto.vehicle.first_seen),
    unit: 'Real-Time ANPR Records',
    status: 'active',
    priority: watchlist.priority,
    target: {
      id: `vehicle-${dto.vehicle.id}`,
      plate: dto.vehicle.plate,
      make: '—',
      model: dto.vehicle.vehicle_class ?? 'vehicle',
      variant: '',
      label: `${dto.vehicle.vehicle_class ?? 'Vehicle'} · ${dto.cameras_seen.length} cameras`,
      color: '—',
      year: 0,
      vehicleClass: dto.vehicle.vehicle_class ?? 'vehicle',
      fuel: '—',
      registeredOwner: 'Registry pull required',
      registrationState: dto.vehicle.plate.slice(0, 2),
      insuranceExpiry: '—',
      fitnessExpiry: '—',
      snapshot: toLiveFrameUrl(dto.vehicle.last_camera_id ?? 'x', Date.now()),
      confidence: Number(((dto.vehicle.best_confidence ?? 0) * 100).toFixed(1)),
      meanConfidence: Number(((dto.mean_confidence ?? 0) * 100).toFixed(1)),
      status: 'on-road',
      watchlist,
      attributes: [
        { label: 'Sightings', value: String(dto.vehicle.total_sightings), confidence: 1 },
        { label: 'Cameras', value: String(dto.cameras_seen.length), confidence: 1 },
        { label: 'First seen', value: clockOf(dto.vehicle.first_seen), confidence: 1 },
        { label: 'Last seen', value: clockOf(dto.vehicle.last_seen), confidence: 1 },
      ],
      history: dto.cases.map((c) => ({
        label: c.case_number,
        detail: `${c.title} · ${c.status}`,
        tone: 'cyan' as const,
      })),
    },
    sightings,
    events,
    associations: [],
  };
}

export function useInvestigationDossier(plate: string, fallback: InvestigationDossier) {
  const [dossier, setDossier] = useState<InvestigationDossier>(fallback);
  const [live, setLive] = useState(false);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    let cancelled = false;
    setDossier(fallbackRef.current);
    api
      .getInvestigationDossier(plate)
      .then((dto) => {
        if (cancelled) return;
        setLive(true);
        setDossier(mapDossier(dto));
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plate]);

  const createCase = useCallback(
    async (payload: CaseCreateInput): Promise<CaseDto> => {
      const created = await api.createInvestigationCaseReal(payload);
      api
        .getInvestigationDossier(plate)
        .then((dto) => {
          setDossier(mapDossier(dto));
        })
        .catch(() => undefined);
      return created;
    },
    [plate],
  );

  return { dossier, live, createCase };
}

/* ------------------------------------------------------------------ *
 * Users & roles
 * ------------------------------------------------------------------ */
const ROLE_ID_MAP: Record<string, RoleId> = {
  ADMIN: 'super-admin',
  SUPERVISOR: 'command-inspector',
  INVESTIGATOR: 'investigation-officer',
  OPERATOR: 'control-room-operator',
  VIEWER: 'viewer',
};

function levelOf(permissions: string[], key: PermissionKey): PermissionLevel {
  const readKeys: Record<PermissionKey, string[]> = {
    dashboard: ['dashboard:read'],
    liveCameras: ['streams:read', 'cameras:read'],
    cameraMap: ['gis:read', 'cameras:read'],
    vehicleSearch: ['vehicles:read', 'detections:read'],
    watchlist: ['watchlist:read'],
    alerts: ['alerts:read'],
    investigation: ['investigation:read'],
    reports: ['analytics:read'],
    cameraHealth: ['health:read'],
    userManagement: ['users:read'],
  };
  const writeKeys: Partial<Record<PermissionKey, string>> = {
    watchlist: 'watchlist:write',
    alerts: 'alerts:acknowledge',
    investigation: 'investigation:write',
    cameraHealth: 'cameras:control',
    userManagement: 'users:write',
  };
  const write = writeKeys[key];
  if (write && permissions.includes(write)) return 'full';
  if (readKeys[key].some((p) => permissions.includes(p))) return 'partial';
  return 'none';
}

export function mapRoleDto(dto: RoleDto, roleMeta: RoleDef): RoleDef {
  const keys: PermissionKey[] = [
    'dashboard',
    'liveCameras',
    'cameraMap',
    'vehicleSearch',
    'watchlist',
    'alerts',
    'investigation',
    'reports',
    'cameraHealth',
    'userManagement',
  ];
  const permissions = keys.reduce<Record<PermissionKey, PermissionLevel>>(
    (acc, key) => {
      acc[key] = levelOf(dto.permissions, key);
      return acc;
    },
    {} as Record<PermissionKey, PermissionLevel>,
  );
  return {
    ...roleMeta,
    id: (ROLE_ID_MAP[dto.id] ?? 'viewer') as RoleId,
    name: dto.name,
    description: dto.description ?? roleMeta.description,
    clearance: dto.id,
    userCount: dto.user_count ?? 0,
    permissions,
  };
}

function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

export function mapUserDto(dto: UserDto, roleId: RoleId): UserRecord {
  const initials = dto.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const lastLogin = dto.last_login_at;
  return {
    id: String(dto.id),
    name: dto.full_name,
    rank: dto.rank ?? '—',
    employeeId: dto.employee_id ?? dto.username,
    roleId,
    title: dto.role_name ?? roleId,
    departmentId: dto.department ?? 'command',
    departmentLabel: dto.department ?? 'Command',
    location: dto.location ?? '—',
    city: (dto.location ?? '').split(',').pop()?.trim() || 'Gujarat',
    status: dto.is_active ? 'offline' : 'disabled',
    email: dto.email ?? `${dto.username}@gujaratpolice.gov.in`,
    phone: dto.phone ?? '—',
    lastActiveMinutes: lastLogin ? minutesSince(lastLogin) : null,
    lastLogin: lastLogin ? `${clockOf(lastLogin)} · ${dayOf(lastLogin)}` : 'Never',
    assignedCameras: 0,
    cameraLabels: [],
    activeInvestigations: 0,
    alertsHandled: 0,
    mfa: false,
    joined: dayOf(dto.created_at),
    initials: initials || dto.username.slice(0, 2).toUpperCase(),
    hue: hueOf(dto.username),
  };
}

export function useUsersDirectory(fallbackUsers: UserRecord[], roleMetas: RoleDef[]) {
  const [users, setUsers] = useState<UserRecord[]>(fallbackUsers);
  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      Promise.all([
        api.getUsers(200).catch(() => null),
        api.getRoles().catch(() => null),
      ]).then(([page, roleDtos]) => {
        if (cancelled) return;
        if (roleDtos && roleDtos.length) {
          const metaById = new Map(roleMetas.map((meta) => [meta.id, meta]));
          const mapped = roleDtos
            .map((dto) => {
              const uiId = ROLE_ID_MAP[dto.id];
              const meta = metaById.get(uiId);
              return meta ? mapRoleDto(dto, meta) : null;
            })
            .filter((r): r is RoleDef => r !== null);
          if (mapped.length) setRoles(mapped);
          if (page && page.items.length) {
            setLive(true);
            setUsers(
              page.items.map((dto) => mapUserDto(dto, ROLE_ID_MAP[dto.role] ?? 'viewer')),
            );
          }
        }
      });
    };
    pull();
    const id = window.setInterval(pull, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUser = useCallback(async (payload: { username: string; password: string; full_name: string; role_id: string; email?: string; rank?: string; department?: string; location?: string; phone?: string }) => {
    const created = await api.createUser(payload);
    const pull2 = () =>
      api
        .getUsers(200)
        .then((page) => setUsers(page.items.map((dto) => mapUserDto(dto, ROLE_ID_MAP[dto.role] ?? 'viewer'))))
        .catch(() => undefined);
    pull2();
    return created;
  }, []);

  return { users, roles, live, createUser };
}

/* ------------------------------------------------------------------ *
 * Evidence (shared previews)
 * ------------------------------------------------------------------ */
export function useEvidenceForPlate(plate: string | null) {
  const [items, setItems] = useState<EvidenceDto[]>([]);
  useEffect(() => {
    if (!plate) {
      setItems([]);
      return;
    }
    let cancelled = false;
    api
      .getEvidence({ plate, limit: 60 })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [plate]);
  return items;
}
