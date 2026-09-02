import { Activity, Download, Pause, Play, RefreshCw, Settings2 } from 'lucide-react';

interface CameraHealthHeaderProps {
  autoRefresh: boolean;
  refreshing: boolean;
  refreshSec: number;
  syncedAt: string;
  attention: number;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

const secondaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

/**
 * Page title bar for CAMERA HEALTH & STREAM MONITORING: identity block on the
 * left, Refresh / Auto Refresh / Export Report / Settings on the right.
 */
export function CameraHealthHeader({
  autoRefresh,
  refreshing,
  refreshSec,
  syncedAt,
  attention,
  onRefresh,
  onToggleAutoRefresh,
  onExport,
  onOpenSettings,
}: CameraHealthHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="page-title flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] border border-accent-cyan/40 bg-accent-cyan/15 shadow-[0_0_12px_-3px_rgba(34,211,238,0.55)]">
            <Activity size={18} className="text-accent-cyan" />
          </span>
          Camera Health
          <span className="rounded-[4px] border border-edge bg-panel-alt px-1.5 py-[1px] font-mono text-3xs font-medium uppercase tracking-[0.12em] text-ink-faint">
            stream monitoring
          </span>
        </h1>
        <p className="page-sub mt-1">
          Monitor camera connectivity, stream quality and AI processing health
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[13px] text-ink-dim">
          <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-accent-green animate-pulse-dot' : 'bg-ink-faint'}`} />
          {autoRefresh ? `auto-refresh ${refreshSec} s` : 'auto-refresh paused'} · synced{' '}
          <span className="tnum font-mono text-[#c3cfe2]">{syncedAt}</span>
          {attention > 0 ? (
            <span className="tnum ml-1 font-semibold text-[#ff8b96]">{attention} need attention</span>
          ) : (
            <span className="ml-1 font-semibold text-[#6fe0b0]">fleet nominal</span>
          )}
        </span>

        <button type="button" title="Refresh camera telemetry now" onClick={onRefresh} className={secondaryBtn}>
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
          Refresh
        </button>

        <button
          type="button"
          title={autoRefresh ? 'Pause automatic refresh' : 'Resume automatic refresh'}
          onClick={onToggleAutoRefresh}
          className={`flex h-[34px] items-center gap-1.5 rounded-[5px] border px-3 text-[12.5px] font-medium transition-colors ${
            autoRefresh
              ? 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff] hover:border-accent-blue'
              : 'border-edge bg-panel text-[#8ea3c4] hover:border-edge-strong hover:text-white'
          }`}
        >
          {autoRefresh ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
          Auto Refresh
        </button>

        <button type="button" title="Export the current monitor grid as CSV" onClick={onExport} className={secondaryBtn}>
          <Download size={14} strokeWidth={2} />
          Export Report
        </button>

        <button
          type="button"
          title="Health thresholds and alerting settings"
          onClick={onOpenSettings}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <Settings2 size={15} strokeWidth={2.4} />
          Settings
        </button>
      </div>
    </div>
  );
}
