import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CameraHealthHeader } from '@/components/camerahealth/CameraHealthHeader';
import { CameraHealthKpiRow } from '@/components/camerahealth/CameraHealthKpiRow';
import { CameraHealthMonitorTable } from '@/components/camerahealth/CameraHealthMonitorTable';
import { CameraHealthSettingsModal } from '@/components/camerahealth/CameraHealthSettingsModal';
import { CameraHealthToolbar } from '@/components/camerahealth/CameraHealthToolbar';
import { CriticalCamerasPanel } from '@/components/camerahealth/CriticalCamerasPanel';
import { HealthByLocationPanel } from '@/components/camerahealth/HealthByLocationPanel';
import { RecentHealthEventsPanel } from '@/components/camerahealth/RecentHealthEventsPanel';
import { SelectedCameraHealthPanel } from '@/components/camerahealth/SelectedCameraHealthPanel';
import { StatusDistributionPanel } from '@/components/camerahealth/StatusDistributionPanel';
import { StreamQualityPanel } from '@/components/camerahealth/StreamQualityPanel';
import {
  cityOptions,
  codecOptions,
  criticalCameras,
  defaultHealthFilters,
  defaultHealthSettings,
  departmentOptions,
  evaluateCamera,
  filterCameras,
  fleetHealth,
  fleetReadout,
  healthCameras,
  healthEvents,
  healthReportCsv,
  liveCamera,
  locationHealth,
  resolutionOptions,
  sortCameras,
  statusCounts,
  streamQualitySeries,
} from '@/data/cameraHealthData';
import { restartCameraStream } from '@/services/api';
import { useTelemetryTick } from '@/hooks/useTelemetryTick';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';

import type { CriticalCamera, HealthCamera, HealthEvaluation, HealthFilters, HealthSettings, HealthSortKey, SortDir } from '@/types/cameraHealth';

const DEFAULT_CAMERA = 'C-001';

/**
 * CAMERA HEALTH & STREAM MONITORING workspace: fleet KPIs, the dense monitor
 * grid, the selected-camera inspector (RTSP / WebRTC / HLS + AI pipeline),
 * stream-quality analytics, status distribution, location ranking, critical
 * feeds and the health-event timeline.
 *
 * Frontend mock data only — every derived number comes from
 * `data/cameraHealthData.ts`. The seams for the real system are:
 *   · `liveCamera(camera, tick)`  → replace with `camera:health` WebSocket frames
 *   · `services/api.ts`           → `getCameraHealthDetail`, `restartCameraStream`
 *   · `evaluateCamera()`          → unchanged; it is pure over the thresholds
 */
export function CameraHealth() {
  const [settings, setSettings] = useState<HealthSettings>(defaultHealthSettings);
  const [filters, setFilters] = useState<HealthFilters>(defaultHealthFilters);
  const [sortKey, setSortKey] = useState<HealthSortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_CAMERA);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Operator-driven changes (Restart Stream) applied over the mock set. */
  const [overrides, setOverrides] = useState<Record<string, Partial<HealthCamera>>>({});

  const noticeTimer = useRef<number | undefined>(undefined);
  const busyTimer = useRef<number | undefined>(undefined);
  const clock = formatClock(useLiveClock());

  const liveTick = useTelemetryTick(settings.refreshSec * 1000);
  const [pausedTick, setPausedTick] = useState(0);
  const tick = autoRefresh ? liveTick : pausedTick;

  const flash = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  useEffect(() => () => window.clearTimeout(busyTimer.current), []);

  /* ---------------- derived telemetry ---------------- */

  const cameras: HealthCamera[] = useMemo(
    () =>
      healthCameras.map((camera) => {
        const drifted = liveCamera(camera, tick);
        const override = overrides[camera.id];
        if (!override) return drifted;
        return { ...drifted, ...override, ai: override.ai ? { ...drifted.ai, ...override.ai } : drifted.ai };
      }),
    [tick, overrides],
  );

  const evaluations = useMemo(
    () =>
      cameras.reduce<Record<string, HealthEvaluation>>((acc, camera) => {
        acc[camera.id] = evaluateCamera(camera, settings);
        return acc;
      }, {}),
    [cameras, settings],
  );

  const counts = useMemo(() => statusCounts(cameras), [cameras]);
  const filtered = useMemo(() => filterCameras(cameras, filters), [cameras, filters]);
  const sorted = useMemo(() => sortCameras(filtered, sortKey, sortDir, settings), [filtered, sortKey, sortDir, settings]);
  const critical = useMemo(() => criticalCameras(cameras, settings), [cameras, settings]);
  const locations = useMemo(() => locationHealth(cameras, settings), [cameras, settings]);
  const readout = useMemo(() => fleetReadout(cameras, settings), [cameras, settings]);

  const departments = useMemo(() => departmentOptions(cameras), [cameras]);
  const cities = useMemo(() => cityOptions(cameras), [cameras]);
  const codecs = useMemo(() => codecOptions(cameras), [cameras]);
  const resolutions = useMemo(() => resolutionOptions(cameras), [cameras]);

  const selectedCamera = cameras.find((camera) => camera.id === selectedId) ?? cameras[0] ?? null;

  const dirty =
    filters.status !== defaultHealthFilters.status ||
    filters.department !== 'all' ||
    filters.city !== 'all' ||
    filters.codec !== 'all' ||
    filters.resolution !== 'all' ||
    filters.query !== '';

  /* ---------------- actions ---------------- */

  const patchFilters = (next: Partial<HealthFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
    flash(`Health poll complete · ${readout.monitored} feeds · ${readout.attention} flagged · ${clock}`);
  };

  const handleToggleAutoRefresh = () => {
    if (autoRefresh) {
      setPausedTick(liveTick);
      flash('Auto refresh paused — telemetry frozen at last poll');
    } else {
      flash(`Auto refresh resumed · polling every ${settings.refreshSec} s`);
    }
    setAutoRefresh((prev) => !prev);
  };

  const handleExport = () => {
    const csv = healthReportCsv(sorted, settings);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gp-camera-health-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${sorted.length} camera health records to CSV`);
  };

  const handleRestart = (id: string) => {
    const camera = cameras.find((item) => item.id === id);
    if (!camera || busyId) return;
    setBusyId(id);
    // Stand-in for `POST /cameras/:id/stream/restart` (see services/api.ts).
    void restartCameraStream(id);
    busyTimer.current = window.setTimeout(() => {
      setBusyId(null);
      // Offline feeds come back as "reconnecting", a retrying feed goes live,
      // and a degraded feed gets its AI pipeline drained.
      const patch: Partial<HealthCamera> =
        camera.status === 'offline'
          ? { status: 'reconnecting' }
          : camera.status === 'reconnecting'
            ? { status: 'online' }
            : {
                ai: {
                  ...camera.ai,
                  queueDepth: 0,
                  gpuUtil: Math.min(68, camera.ai.gpuUtil),
                  lastInferenceMs: Math.max(24, Math.round(camera.ai.lastInferenceMs / 2)),
                },
              };
      setOverrides((prev) => ({ ...prev, [id]: patch }));
      const next = patch.status ?? camera.status;
      flash(
        patch.ai
          ? `${id} · pipeline restarted on ${camera.edgeNode} · AI queue drained to 0 · GPU ${patch.ai.gpuUtil}%`
          : `${id} · RTSP session re-opened on ${camera.edgeNode} · state ${camera.status} → ${next} · ${camera.rtsp.transport} :554`,
      );
    }, 1500);
  };

  const handleSnapshot = (id: string) => {
    const camera = cameras.find((item) => item.id === id);
    if (!camera) return;
    flash(
      camera.status === 'offline'
        ? `${id} · snapshot failed — no frames in the ingest buffer`
        : `${id} · snapshot captured ${camera.resolution} JPEG · stored to the evidence bucket`,
    );
  };

  const handleCriticalAction = (item: CriticalCamera) => {
    setSelectedId(item.cameraId);
    if (item.action === 'Restart Stream') {
      handleRestart(item.cameraId);
      return;
    }
    flash(
      item.action === 'Re-pair ANPR'
        ? `${item.cameraId} · ANPR re-pair queued on ${item.camera.edgeNode} · OCR queue draining`
        : `${item.cameraId} · escalated to the ${item.camera.department} duty desk`,
    );
  };

  const handleApplySettings = (next: HealthSettings) => {
    setSettings(next);
    setSettingsOpen(false);
    flash(`Thresholds applied · latency ${next.latencyWarnMs}/${next.latencyCritMs} ms · loss ${next.lossWarnPct}/${next.lossCritPct}%`);
  };

  /* ---------------- render ---------------- */

  return (
    <div className="page relative">
      <CameraHealthHeader
        autoRefresh={autoRefresh}
        refreshing={refreshing}
        refreshSec={settings.refreshSec}
        syncedAt={clock}
        attention={readout.attention}
        onRefresh={handleRefresh}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <CameraHealthKpiRow
        active={filters.status}
        monitored={readout.monitored}
        attention={readout.attention}
        onSelect={(filter) => patchFilters({ status: filter })}
      />

      <CameraHealthToolbar
        filters={filters}
        onFilters={patchFilters}
        counts={counts}
        departments={departments}
        cities={cities}
        codecs={codecs}
        resolutions={resolutions}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKey={setSortKey}
        onSortDir={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
        onReset={() => setFilters(defaultHealthFilters)}
        dirty={dirty}
        shown={sorted.length}
      />

      {/* monitor grid + selected camera inspector */}
      <div
        className="grid shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(330px,370px)]"
        style={{ height: 'clamp(480px, 52vh, 640px)' }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <CameraHealthMonitorTable
            cameras={sorted}
            evaluations={evaluations}
            settings={settings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            fleetTotal={fleetHealth.total}
            shown={sorted.length}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <SelectedCameraHealthPanel
            camera={selectedCamera}
            evaluation={selectedCamera ? evaluations[selectedCamera.id] ?? null : null}
            tick={tick}
            busy={busyId === selectedId}
            onRestart={handleRestart}
            onSnapshot={handleSnapshot}
          />
        </div>
      </div>

      <div className="shrink-0" style={{ height: 'clamp(220px, 24vh, 300px)' }}>
        <StreamQualityPanel series={streamQualitySeries} settings={settings} />
      </div>

      {/* distribution · location ranking · critical feeds */}
      <div
        className="grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-[30fr_34fr_36fr]"
        style={{ height: 'clamp(300px, 32vh, 400px)' }}
      >
        <div className="min-w-0">
          <StatusDistributionPanel fleet={fleetHealth} active={filters.status} onSelect={(id) => patchFilters({ status: id as HealthFilters['status'] })} />
        </div>
        <div className="min-w-0">
          <HealthByLocationPanel rows={locations} onDrill={(area) => patchFilters({ query: area })} />
        </div>
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <CriticalCamerasPanel items={critical} busyId={busyId} onAct={handleCriticalAction} onSelect={setSelectedId} selectedId={selectedId} />
        </div>
      </div>

      <div className="shrink-0" style={{ height: 'clamp(260px, 28vh, 360px)' }}>
        <RecentHealthEventsPanel events={healthEvents} onSelectCamera={setSelectedId} selectedId={selectedId} />
      </div>

      {/* transient operator feedback */}
      {notice ? (
        <div className="pointer-events-none sticky bottom-2 left-1/2 z-30 w-fit max-w-[92%] -translate-x-1/2 animate-flash-in rounded-[5px] border border-accent-blue/50 bg-[#0b1730]/95 px-3 py-1.5 text-[12px] text-[#cfe0ff] shadow-[0_0_20px_-6px_rgba(47,125,255,0.85)]">
          {notice}
        </div>
      ) : null}

      <CameraHealthSettingsModal
        open={settingsOpen}
        settings={settings}
        cameras={cameras}
        onClose={() => setSettingsOpen(false)}
        onApply={handleApplySettings}
      />
    </div>
  );
}
