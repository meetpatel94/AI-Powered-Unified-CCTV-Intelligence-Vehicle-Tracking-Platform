import { CalendarClock, Download, FileBarChart2, FilePlus2, RefreshCw } from 'lucide-react';

import { primaryBtn, secondaryBtn } from '@/components/reports/reportTones';

interface ReportsHeaderProps {
  syncedAt: string;
  pending: number;
  refreshing: boolean;
  exporting: boolean;
  onGenerate: () => void;
  onSchedule: () => void;
  onExport: () => void;
  onRefresh: () => void;
}

/**
 * Page title bar for the INTELLIGENCE REPORTS & ANALYTICS workspace:
 * identity block on the left, Generate / Schedule / Export / Refresh on the right.
 */
export function ReportsHeader({
  syncedAt,
  pending,
  refreshing,
  exporting,
  onGenerate,
  onSchedule,
  onExport,
  onRefresh,
}: ReportsHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="page-title flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] border border-accent-cyan/40 bg-accent-cyan/15 shadow-[0_0_12px_-3px_rgba(34,211,238,0.55)]">
            <FileBarChart2 size={18} className="text-accent-cyan" />
          </span>
          Reports
          <span className="rounded-[4px] border border-edge bg-panel-alt px-1.5 py-[1px] font-mono text-3xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            intelligence reports &amp; analytics
          </span>
        </h1>
        <p className="page-sub mt-1">Generate, review and export CCTV intelligence reports</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[13px] text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          registry synced <span className="tnum font-mono text-[#c3cfe2]">{syncedAt}</span>
          {pending > 0 ? (
            <span className="tnum ml-1 font-semibold text-[#f7b95f]">{pending} in queue</span>
          ) : (
            <span className="ml-1 font-semibold text-[#6fe0b0]">queue clear</span>
          )}
        </span>

        <button type="button" title="Re-poll the report registry" onClick={onRefresh} className={secondaryBtn}>
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
          Refresh
        </button>

        <button
          type="button"
          title="Export the visible report registry as CSV"
          onClick={onExport}
          className={secondaryBtn}
        >
          <Download size={14} strokeWidth={2} className={exporting ? 'animate-pulse text-accent-cyan' : ''} />
          Export
        </button>

        <button
          type="button"
          title="Register a recurring report schedule"
          onClick={onSchedule}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-accent-cyan/50 bg-accent-cyan/10 px-3 text-[12.5px] font-semibold text-[#8ff0ff] transition-colors hover:border-accent-cyan hover:bg-accent-cyan/20"
        >
          <CalendarClock size={14} strokeWidth={2.2} />
          Schedule Report
        </button>

        <button type="button" title="Configure and generate a new intelligence report" onClick={onGenerate} className={primaryBtn}>
          <FilePlus2 size={15} strokeWidth={2.4} />
          Generate Report
        </button>
      </div>
    </div>
  );
}
