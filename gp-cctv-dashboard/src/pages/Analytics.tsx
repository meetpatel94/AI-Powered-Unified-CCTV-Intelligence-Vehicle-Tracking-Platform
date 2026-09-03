import { useRef, useState } from 'react';

import { AiEventsByTypePanel } from '@/components/analytics/AiEventsByTypePanel';
import { AnalyticsHeader } from '@/components/analytics/AnalyticsHeader';
import { AnalyticsKpiRow } from '@/components/analytics/AnalyticsKpiRow';
import { AnprPerformancePanel } from '@/components/analytics/AnprPerformancePanel';
import { CameraActivityPanel } from '@/components/analytics/CameraActivityPanel';
import { DetailedReportDrawer } from '@/components/analytics/DetailedReportDrawer';
import { HourlyActivityHeatmap } from '@/components/analytics/HourlyActivityHeatmap';
import { IntelligenceSummaryPanel } from '@/components/analytics/IntelligenceSummaryPanel';
import { TopDetectionLocationsPanel } from '@/components/analytics/TopDetectionLocationsPanel';
import { VehicleDetectionTrend } from '@/components/analytics/VehicleDetectionTrend';
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
 * AI ANALYTICS & INTELLIGENCE workspace: KPI strip, dense chart grid and an
 * auto-generated briefing. `/api/analytics/summary` + `/api/dashboard/activity`
 * feed a real `AnalyticsSnapshot` merged over the mock `computeAnalytics`
 * baseline, so every panel keeps rendering when the backend is unreachable.
 */
export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [refreshing, setRefreshing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
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

      <AnalyticsKpiRow kpis={snapshot.kpis} />

      {/* trend + mix + events */}
      <div
        className="responsive-band responsive-band-mid grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,26fr)_minmax(270px,27fr)]"
      >
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <VehicleDetectionTrend snapshot={snapshot} />
        </div>
        <div className="min-w-0">
          <VehicleTypesPanel types={snapshot.vehicleTypes} total={snapshot.kpis.vehicles} windowNote={snapshot.windowNote} />
        </div>
        <div className="min-w-0">
          <AiEventsByTypePanel events={snapshot.eventTypes} total={snapshot.kpis.events} windowNote={snapshot.windowNote} />
        </div>
      </div>

      {/* ANPR + cameras + locations */}
      <div
        className="responsive-band responsive-band-chart grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-[minmax(270px,28fr)_minmax(0,1fr)_minmax(280px,30fr)]"
      >
        <div className="min-w-0">
          <AnprPerformancePanel anpr={snapshot.anpr} />
        </div>
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <CameraActivityPanel cameras={snapshot.cameras} onSelectCamera={(camera) => patchFilters({ camera })} />
        </div>
        <div className="min-w-0">
          <TopDetectionLocationsPanel
            locations={snapshot.locations}
            onSelectLocation={(location) => patchFilters({ location, camera: 'all' })}
          />
        </div>
      </div>

      {/* watchlist + heatmap */}
      <div
        className="responsive-band responsive-band-chart grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-10 xl:grid-cols-[40fr_60fr]"
      >
        <div className="min-w-0 md:col-span-4 xl:col-span-1">
          <WatchlistMatchTrendPanel series={snapshot.watchlistTrend} windowNote={snapshot.windowNote} />
        </div>
        <div className="min-w-0 md:col-span-6 xl:col-span-1">
          <HourlyActivityHeatmap grid={snapshot.heatmap} />
        </div>
      </div>

      {/* briefing */}
      <div className="shrink-0">
        <IntelligenceSummaryPanel
          insights={snapshot.insights}
          unusual={snapshot.unusual}
          generatedAt={snapshot.generatedAt}
          onViewReport={() => setReportOpen(true)}
        />
      </div>

      <DetailedReportDrawer
        snapshot={reportOpen ? snapshot : null}
        onClose={() => setReportOpen(false)}
        onExport={handleExport}
      />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] animate-flash-in rounded-[6px] border border-accent-green/50 bg-[#0b2e26] px-3 py-2 text-[12.5px] font-medium text-[#6fe0b0] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
