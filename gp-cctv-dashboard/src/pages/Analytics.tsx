import { useRef, useState } from 'react';

import { AiEventsByTypePanel } from '@/components/analytics/AiEventsByTypePanel';
import { AnalyticsActivityMap } from '@/components/analytics/AnalyticsActivityMap';
import { AnalyticsHeader } from '@/components/analytics/AnalyticsHeader';
import { AnalyticsKpiRow } from '@/components/analytics/AnalyticsKpiRow';
import { CameraActivityInsightsPanel } from '@/components/analytics/CameraActivityInsightsPanel';
import { VehicleTypesPanel } from '@/components/analytics/VehicleTypesPanel';
import { WatchlistMatchTrendPanel } from '@/components/analytics/WatchlistMatchTrendPanel';
import { defaultAnalyticsFilters } from '@/data/analyticsData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useAnalyticsSnapshot } from '@/hooks/useIntelligence';
import type { AnalyticsFilters, AnalyticsSnapshot } from '@/types/analytics';

function exportSnapshot(snapshot: AnalyticsSnapshot) {
  const lines = [
    '# Gujarat Police — AI Analytics & Intelligence',
    `# Range,${snapshot.rangeLabel}`,
    `# Location,${snapshot.locationLabel}`,
    `# Camera,${snapshot.cameraLabel}`,
    `# Generated,01 Sep 2026 ${snapshot.generatedAt}`,
    '',
    'kpi,value',
    `vehicles_detected,${snapshot.kpis.vehicles}`,
    `anpr_reads,${snapshot.kpis.anpr}`,
    `ai_events,${snapshot.kpis.events}`,
    `watchlist_matches,${snapshot.kpis.watchlist}`,
    `active_cameras,${snapshot.kpis.cameras}`,
    `anpr_confidence_pct,${snapshot.anpr.confidence}`,
    `anpr_unreadable,${snapshot.anpr.unreadable}`,
    '',
    'watchlist_trend_date,matches,critical',
    ...snapshot.watchlistTrend.map((point) => `${point.label},${point.matches},${point.critical}`),
    '',
    'vehicle_type,count',
    ...snapshot.vehicleTypes.map((slice) => `${slice.label},${slice.value}`),
    '',
    'ai_event_type,count',
    ...snapshot.eventTypes.map((bar) => `${bar.label},${bar.value}`),
    '',
    'camera,location,city,detections,events,status',
    ...snapshot.cameras.map(
      (camera) => `${camera.code},${camera.location},${camera.city},${camera.detections},${camera.events},${camera.status}`,
    ),
    '',
    'location,city,detections,share_pct',
    ...snapshot.locations.map((row) => `${row.name},${row.city},${row.detections},${row.share.toFixed(1)}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'gp-analytics-2026-09-01.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * AI ANALYTICS & INTELLIGENCE workspace, ordered by operator priority:
 *   1. header + date/location/camera filters (+ refresh / CSV export)
 *   2. compact KPI cards (vehicles · ANPR · AI events · watchlist · cameras)
 *   3. watchlist match trend (left) + AI events by type (right)
 *   4. GIS / activity map — camera activity, detection locations,
 *      watchlist-match locations and AI-event hotspots
 *   5. vehicle type distribution (left) + camera / activity insights (right)
 * `/api/analytics/summary` + `/api/dashboard/activity` feed a real
 * `AnalyticsSnapshot` merged over the mock `computeAnalytics` baseline, and the
 * map reuses the live `/api/gis/cameras` fleet, so every section keeps
 * rendering when the backend is unreachable. Normal document flow, vertical
 * scroll, minmax(0,1fr) grid tracks — no horizontal overflow, no clipped
 * fixed-height content.
 */
export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const clock = formatClock(useLiveClock());

  const flash = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  };

  const { snapshot, live, refresh } = useAnalyticsSnapshot(filters);

  const patchFilters = (next: Partial<AnalyticsFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  /** Map markers and camera lists toggle the page-wide camera filter. */
  const toggleCameraFilter = (code: string) => {
    patchFilters({ camera: filters.camera === code ? 'all' : code });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    window.setTimeout(() => setRefreshing(false), 800);
    flash(
      `Analytics synced${live ? ' · live pipeline data' : ' · offline fixtures'} · ${snapshot.kpis.vehicles.toLocaleString('en-IN')} vehicles · ${snapshot.generatedAt}`,
    );
  };

  const handleExport = () => {
    exportSnapshot(snapshot);
    flash(`Exported analytics briefing (${snapshot.rangeLabel})`);
  };

  return (
    <div className="page">
      <AnalyticsHeader
        filters={filters}
        onFilters={patchFilters}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onExport={handleExport}
        clock={clock}
      />

      {/* 1 · Compact KPI strip: vehicles · ANPR reads · AI events · watchlist · cameras */}
      <AnalyticsKpiRow kpis={snapshot.kpis} />

      {/* 2 · Priority analytics row: watchlist match trend (left) + AI events by
          type (right). minmax(0,1fr) tracks keep both charts equal and
          overflow-free; collapses to one column below xl. */}
      <div className="responsive-band responsive-band-chart grid min-h-0 shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WatchlistMatchTrendPanel series={snapshot.watchlistTrend} windowNote={snapshot.windowNote} />
        <AiEventsByTypePanel events={snapshot.eventTypes} total={snapshot.kpis.events} windowNote={snapshot.windowNote} />
      </div>

      {/* 3 · GIS / activity map: camera activity, detection locations,
          watchlist-match locations and AI-event hotspots on the shared SVG
          world. Analytics-focused — pan/zoom + click-to-filter only, the full
          Camera Map tooling stays on /camera-map. */}
      <AnalyticsActivityMap snapshot={snapshot} onSelectCamera={toggleCameraFilter} />

      {/* 4 · Supporting row: vehicle type distribution (left) + compact
          camera / activity insights (right). */}
      <div className="responsive-band responsive-band-mid grid min-h-0 shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <VehicleTypesPanel types={snapshot.vehicleTypes} total={snapshot.kpis.vehicles} windowNote={snapshot.windowNote} />
        <CameraActivityInsightsPanel
          cameras={snapshot.cameras}
          anpr={snapshot.anpr}
          unusual={snapshot.unusual}
          peakLabel={snapshot.peakLabel}
          peakValue={snapshot.peakValue}
          peakUnit={snapshot.vehicleTrendUnit}
          onSelectCamera={toggleCameraFilter}
        />
      </div>

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] animate-flash-in rounded-[6px] border border-accent-green/50 bg-[#0b2e26] px-3 py-2 text-[12.5px] font-medium text-[#6fe0b0] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
