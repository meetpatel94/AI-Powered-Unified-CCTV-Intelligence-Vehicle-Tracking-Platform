import { BellRing, CheckCheck, Download, RefreshCw, SlidersHorizontal } from 'lucide-react';

interface AlertsHeaderProps {
  filtersVisible: boolean;
  refreshing: boolean;
  unreviewed: number;
  syncedAt: string;
  onToggleFilters: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onMarkAllReviewed: () => void;
}

const secondaryBtn =
  'flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 text-[10.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

/** Page title bar: ALERT MANAGEMENT identity + refresh / filter / export / review actions. */
export function AlertsHeader({
  filtersVisible,
  refreshing,
  unreviewed,
  syncedAt,
  onToggleFilters,
  onRefresh,
  onExport,
  onMarkAllReviewed,
}: AlertsHeaderProps) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.1em] text-white">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-red/40 bg-accent-red/15 shadow-[0_0_12px_-3px_rgba(239,68,68,0.55)]">
            <BellRing size={14} className="text-accent-red" />
          </span>
          Alert Management
        </h1>
        <p className="mt-[3px] text-[10.5px] text-ink-dim">
          Real-time AI detection, watchlist matches and incident response
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-3xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          auto-sync 15 s · synced {syncedAt}
          {unreviewed > 0 ? <span className="tnum ml-1 font-semibold text-[#f7b95f]">{unreviewed} unreviewed</span> : null}
        </span>

        <button type="button" title="Refresh feed" onClick={onRefresh} className={secondaryBtn}>
          <RefreshCw size={12} strokeWidth={2} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
          Refresh
        </button>

        <button
          type="button"
          title="Toggle filter bar"
          onClick={onToggleFilters}
          className={`grid h-[30px] w-[30px] place-items-center rounded-[5px] border transition-colors ${
            filtersVisible
              ? 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff]'
              : 'border-edge bg-panel text-[#8ea3c4] hover:border-edge-strong hover:text-white'
          }`}
        >
          <SlidersHorizontal size={13} strokeWidth={2} />
        </button>

        <button type="button" title="Export visible alerts as CSV" onClick={onExport} className={secondaryBtn}>
          <Download size={12} strokeWidth={2} />
          Export
        </button>

        <button
          type="button"
          onClick={onMarkAllReviewed}
          className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3 text-[10.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <CheckCheck size={13} strokeWidth={2.4} />
          Mark All Reviewed
        </button>
      </div>
    </div>
  );
}
