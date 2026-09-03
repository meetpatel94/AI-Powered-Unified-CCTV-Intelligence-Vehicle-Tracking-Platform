import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';

import { GenerateReportModal } from '@/components/reports/GenerateReportModal';
import { RecentReportsTable, type DownloadState } from '@/components/reports/RecentReportsTable';
import { ReportBuilderPanel } from '@/components/reports/ReportBuilderPanel';
import { ReportDistributionPanel } from '@/components/reports/ReportDistributionPanel';
import { ReportPreviewPanel } from '@/components/reports/ReportPreviewPanel';
import { ReportViewerModal } from '@/components/reports/ReportViewerModal';
import { ReportsByTypePanel } from '@/components/reports/ReportsByTypePanel';
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { ReportsKpiRow } from '@/components/reports/ReportsKpiRow';
import { ReportsOverTimePanel } from '@/components/reports/ReportsOverTimePanel';
import { ScheduledReportsPanel } from '@/components/reports/ScheduledReportsPanel';
import { TopReportedLocationsPanel } from '@/components/reports/TopReportedLocationsPanel';
import {
  defaultReportFilters,
  frequencyLabel,
  nextReportId,
  recentReports,
  reportDownloadBody,
  reportTypeById,
  reportsRegistryCsv,
  sampleReportPreview,
  scheduledReports,
} from '@/data/reportsData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useReports, type RealReportView } from '@/hooks/useReports';
import { readStoredToken } from '@/services/realtime';
import type {
  GenerateReportConfig,
  ReportFilters,
  ReportRecord,
  ScheduledReport,
} from '@/types/reports';

/** Merge a real backend report view into the page's ReportRecord shape. */
function realToRecord(r: RealReportView): ReportRecord {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    generatedAt: r.generatedAt,
    createdBy: r.createdBy,
    creatorRank: r.creatorRank,
    status: r.status,
    sizeMb: r.sizeMb,
    format: r.format,
    pages: r.pages,
    classification: r.classification,
    scope: r.scope,
    cameras: r.cameras,
    records: r.records,
  };
}

function downloadBlob(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * REPORTS — INTELLIGENCE REPORTS & ANALYTICS workspace.
 *
 * Frontend mock data only: the registry, schedules, analytics series and the
 * sample preview document all come from `data/reportsData.ts`. Backend seams
 * (report generation, database queries, PDF export, scheduled delivery) are
 * documented in `services/api.ts` — the page already speaks those payload
 * shapes, so wiring the real engine is a data-source swap.
 */
export function Reports() {
  const clock = formatClock(useLiveClock());

  /* ---------------- state ---------------- */

  // Real backend reports (PostgreSQL) with the bundled demo fixtures shown
  // only until/unless the API is reachable — same fallback pattern as every
  // other workspace screen.
  const { reports: realReports, backendLive, generate: generateReal, downloadUrl, load: reloadReports } =
    useReports();

  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters);
  const [reports, setReports] = useState<ReportRecord[]>(recentReports);
  const [schedules, setSchedules] = useState<ScheduledReport[]>(scheduledReports);
  const [selectedId, setSelectedId] = useState<string | null>(recentReports[0]?.id ?? null);

  // When real reports arrive, make them the registry (real rows first).
  useEffect(() => {
    if (backendLive) {
      const rows = realReports.map(realToRecord);
      setReports(rows.length ? rows : recentReports);
      setSelectedId((cur) => cur ?? rows[0]?.id ?? recentReports[0]?.id ?? null);
    }
  }, [backendLive, realReports]);
  const [query, setQuery] = useState('');
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'now' | 'schedule'>('now');
  const [viewerReport, setViewerReport] = useState<ReportRecord | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatedDelta, setGeneratedDelta] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const noticeTimer = useRef<number | undefined>(undefined);
  const pendingTimers = useRef<number[]>([]);

  const flash = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3400);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
      pendingTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  /* ---------------- derived ---------------- */

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [report.id, report.name, report.createdBy, report.scope, reportTypeById(report.type).label]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [reports, query]);

  const queueCount = reports.filter(
    (report) => report.status === 'pending' || report.status === 'generating',
  ).length;

  /* ---------------- actions ---------------- */

  const patchFilters = (next: Partial<ReportFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  const openGenerate = (mode: 'now' | 'schedule') => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleModalSubmit = (config: GenerateReportConfig) => {
    setModalOpen(false);
    const type = reportTypeById(config.type);

    if (config.mode === 'schedule') {
      const schedule: ScheduledReport = {
        id: `SCH-${String(22 + schedules.length).padStart(3, '0')}`,
        name: config.name,
        type: config.type,
        frequency: config.frequency,
        cadence: `${frequencyLabel[config.frequency]} · ${config.runAt} IST`,
        nextRun: `03 Sep 2026 · ${config.runAt}`,
        lastRun: '—',
        recipient: config.notifyRecipient,
        recipientRole: config.department === 'All Departments' ? 'Operations' : config.department,
        format: config.format,
        active: true,
      };
      setSchedules((prev) => [schedule, ...prev]);
      flash(`${schedule.id} registered · ${config.name} · ${schedule.cadence} → ${config.notifyRecipient}`);
      return;
    }

    // Real backend: generate over PostgreSQL data.
    generateReal({
      uiType: config.type,
      name: config.name,
      format: config.format,
      classification: config.classification,
      camera: config.camera,
    })
      .then((created) => {
        if (created) {
          setSelectedId(created.id);
          setGeneratedDelta((prev) => prev + 1);
          flash(
            created.raw.status === 'completed'
              ? `${created.id} generated · ${created.records} records from live data · ${config.format} ready`
              : `${created.id} queued on the report engine · ${type.label}`,
          );
          void reloadReports();
        } else {
          runMockGeneration(config);
        }
      })
      .catch(() => runMockGeneration(config));
  };

  /** Demo-fixture generation used only when the backend is unreachable. */
  const runMockGeneration = (config: GenerateReportConfig) => {
    const id = nextReportId();
    const record: ReportRecord = {
      id,
      name: config.name,
      type: config.type,
      generatedAt: `02 Sep 2026 · ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`,
      createdBy: 'Rajveer Chauhan',
      creatorRank: 'Inspector',
      status: 'generating',
      sizeMb: null,
      format: config.format,
      pages: 0,
      classification: config.classification,
      scope: config.location,
      cameras: config.camera === 'All Cameras' ? 12842 : 1,
      records: 0,
    };
    setReports((prev) => [record, ...prev]);
    setSelectedId(id);
    flash(`${id} queued on the report engine · ${reportTypeById(config.type).label} · demo data`);

    // Simulated render completion (demo fixtures only).
    const timer = window.setTimeout(() => {
      setReports((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: 'completed',
                sizeMb: Number((2.4 + Math.random() * 6).toFixed(1)),
                pages: 8 + Math.floor(Math.random() * 22),
                records: 20 + Math.floor(Math.random() * 300),
              }
            : row,
        ),
      );
      setGeneratedDelta((prev) => prev + 1);
      flash(`${id} rendered · ${config.sections.length} sections · ${config.format} ready for download`);
    }, 2800 + Math.random() * 1500);
    pendingTimers.current.push(timer);
  };

  const handleDownload = (report: ReportRecord) => {
    if (report.status !== 'completed') return;
    // Real backend report (RPT-…): stream the actual generated CSV document.
    if (report.id.startsWith('RPT-')) {
      setDownloadStates((prev) => ({ ...prev, [report.id]: 'busy' }));
      const token = readStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      fetch(downloadUrl(report.id), { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`download failed ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${report.id}-${report.type}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          setDownloadStates((prev) => ({ ...prev, [report.id]: 'done' }));
          flash(`${report.id} · ${report.format} downloaded · access logged to the audit trail`);
        })
        .catch(() => {
          setDownloadStates((prev) => ({ ...prev, [report.id]: 'idle' }));
          flash(`${report.id} · download unavailable`);
        });
      return;
    }
    setDownloadStates((prev) => ({ ...prev, [report.id]: 'busy' }));
    const timer = window.setTimeout(() => {
      downloadBlob(
        reportDownloadBody(report),
        'text/plain;charset=utf-8',
        `${report.id}-${report.format.toLowerCase()}-summary.txt`,
      );
      setDownloadStates((prev) => ({ ...prev, [report.id]: 'done' }));
      flash(`${report.id} · ${report.format} saved (${report.sizeMb?.toFixed(1)} MB) · access logged to the audit trail`);
      const reset = window.setTimeout(
        () => setDownloadStates((prev) => ({ ...prev, [report.id]: 'idle' })),
        2600,
      );
      pendingTimers.current.push(reset);
    }, 850);
    pendingTimers.current.push(timer);
  };

  const handleShare = (report: ReportRecord) => {
    const link = `https://reports.gujaratpolice.gov.in/s/${report.id.toLowerCase()}-7f3a`;
    void navigator.clipboard?.writeText(link).catch(() => undefined);
    flash(`${report.id} · secure share link copied · expires in 72 h · recipient must hold ${report.classification.toUpperCase()} clearance`);
  };

  const handleExport = () => {
    setExporting(true);
    const timer = window.setTimeout(() => {
      downloadBlob(
        reportsRegistryCsv(visibleReports),
        'text/csv;charset=utf-8',
        `gp-report-registry-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      setExporting(false);
      flash(`Exported ${visibleReports.length} registry rows to CSV`);
    }, 700);
    pendingTimers.current.push(timer);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    const timer = window.setTimeout(() => setRefreshing(false), 700);
    pendingTimers.current.push(timer);
    flash(`Registry re-polled · ${reports.length} documents · ${queueCount} in queue · ${clock}`);
  };

  const handleToggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((schedule) => (schedule.id === id ? { ...schedule, active: !schedule.active } : schedule)),
    );
    const schedule = schedules.find((item) => item.id === id);
    if (schedule) {
      flash(
        schedule.active
          ? `${schedule.id} · ${schedule.name} paused — no further automatic runs`
          : `${schedule.id} · ${schedule.name} activated · next run ${schedule.nextRun}`,
      );
    }
  };

  const handleRunNow = (schedule: ScheduledReport) => {
    handleModalSubmit({
      ...defaultReportFilters,
      type: schedule.type,
      name: `${schedule.name} (manual run)`,
      format: schedule.format,
      classification: 'internal',
      sections: reportTypeById(schedule.type).sections,
      notifyRecipient: schedule.recipient,
      mode: 'now',
      frequency: schedule.frequency,
      runAt: '06:00',
    });
  };

  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;

  /* ---------------- render ---------------- */

  return (
    <div className="page relative">
      <ReportsHeader
        syncedAt={clock}
        pending={queueCount}
        refreshing={refreshing}
        exporting={exporting}
        onGenerate={() => openGenerate('now')}
        onSchedule={() => openGenerate('schedule')}
        onExport={handleExport}
        onRefresh={handleRefresh}
      />

      <ReportsKpiRow extraGenerated={generatedDelta} />

      {/* builder + registry | preview */}
      <div className="grid min-w-0 gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,384px)]">
        <div className="flex min-w-0 flex-col gap-[var(--page-gap)]">
          <ReportBuilderPanel filters={filters} onChange={patchFilters} onGenerate={() => openGenerate('now')} />
          <RecentReportsTable
            reports={visibleReports}
            selectedId={selectedId}
            query={query}
            downloadStates={downloadStates}
            onQuery={setQuery}
            onSelect={(report) => setSelectedId(report.id)}
            onView={setViewerReport}
            onDownload={handleDownload}
            onShare={handleShare}
          />
        </div>

        {/* bounded to the left column height on xl so the document scrolls internally */}
        <div className="relative min-w-0 xl:min-h-[560px]">
          <div className="xl:absolute xl:inset-0">
            <ReportPreviewPanel
              doc={sampleReportPreview}
              selectedReportId={selectedId}
              onExpand={() => setViewerReport(selectedReport ?? reports[0] ?? null)}
            />
          </div>
        </div>
      </div>

      {/* REPORT ANALYTICS */}
      <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
        <BarChart3 size={15} className="shrink-0 text-accent-cyan" />
        <h2 className="panel-title">Report Analytics</h2>
        <span className="h-px flex-1 bg-edge" />
        <span className="tnum text-2xs uppercase tracking-[0.1em] text-ink-faint">rolling 30-day window</span>
      </div>
      <div className="grid gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-[300px] min-w-0 flex-col [&>*]:flex-1">
          <ReportsByTypePanel />
        </div>
        <div className="flex min-h-[300px] min-w-0 flex-col [&>*]:flex-1">
          <ReportsOverTimePanel />
        </div>
        <div className="flex min-h-[300px] min-w-0 flex-col [&>*]:flex-1">
          <ReportDistributionPanel />
        </div>
        <div className="flex min-h-[300px] min-w-0 flex-col [&>*]:flex-1">
          <TopReportedLocationsPanel />
        </div>
      </div>

      <ScheduledReportsPanel
        schedules={schedules}
        onToggle={handleToggleSchedule}
        onRunNow={handleRunNow}
        onAdd={() => openGenerate('schedule')}
      />

      {/* transient operator feedback */}
      {notice ? (
        <div className="pointer-events-none sticky bottom-2 left-1/2 z-30 w-fit max-w-[92%] -translate-x-1/2 animate-flash-in rounded-[5px] border border-accent-blue/50 bg-[#0b1730]/95 px-3 py-1.5 text-[12px] text-[#cfe0ff] shadow-[0_0_20px_-6px_rgba(47,125,255,0.85)]">
          {notice}
        </div>
      ) : null}

      <GenerateReportModal
        open={modalOpen}
        mode={modalMode}
        seed={filters}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <ReportViewerModal
        open={viewerReport !== null}
        report={viewerReport}
        doc={sampleReportPreview}
        onClose={() => setViewerReport(null)}
        onDownload={handleDownload}
        onShare={handleShare}
      />
    </div>
  );
}
