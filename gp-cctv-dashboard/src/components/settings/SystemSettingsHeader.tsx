import {
  Activity,
  History,
  RotateCcw,
  Save,
  Settings,
  Zap,
} from 'lucide-react';

interface SystemSettingsHeaderProps {
  dirtyCount: number;
  /** Number of sections containing at least one pending edit. */
  dirtySections: number;
  /** Validation failures that block save/apply. */
  errorCount: number;
  onSave: () => void;
  onReset: () => void;
  onApply: () => void;
}

/**
 * Page title bar: SYSTEM SETTINGS identity, save / reset / apply command
 * cluster and the live system status indicator.
 */
export function SystemSettingsHeader({
  dirtyCount,
  dirtySections,
  errorCount,
  onSave,
  onReset,
  onApply,
}: SystemSettingsHeaderProps) {
  const pristine = dirtyCount === 0;
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="page-title flex items-center gap-2.5">
          <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[8px] border border-accent-cyan/40 bg-accent-cyan/12 shadow-[0_0_14px_-3px_rgba(34,211,238,0.65)]">
            <Settings size={19} strokeWidth={1.9} className="text-accent-cyan" />
          </span>
          System Settings
        </h1>
        <p className="page-sub mt-1">Configure CCTV, AI intelligence, alerts, security and platform operations</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Unsaved-changes indicator */}
        {dirtyCount > 0 ? (
          <span className="mr-1 flex items-center gap-1.5 rounded-[5px] border border-accent-orange/45 bg-[#231a08] px-2.5 py-[6px] text-[11.5px] font-semibold text-[#f7b95f]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-orange" />
            </span>
            <span className="tnum">{dirtyCount}</span> unsaved change{dirtyCount === 1 ? '' : 's'} · {dirtySections} section{dirtySections === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="mr-1 flex items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 py-[6px] text-[11.5px] font-medium text-ink-dim">
            <History size={13} className="text-ink-faint" />
            All changes committed
          </span>
        )}

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          disabled={pristine}
          title={pristine ? 'No unsaved changes to discard' : 'Discard unsaved changes'}
          className={`flex h-[36px] items-center gap-1.5 rounded-[6px] border px-3.5 text-[13px] font-semibold transition-all ${
            pristine
              ? 'cursor-not-allowed border-edge bg-panel/40 text-ink-faint'
              : 'border-[#c26a1d]/50 bg-[#2b1a06]/70 text-[#f7b95f] hover:border-[#f59e0b]/70 hover:bg-[#2b1a06] hover:shadow-[0_0_12px_-4px_rgba(245,158,11,0.7)]'
          }`}
        >
          <RotateCcw size={14} strokeWidth={2.2} />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          disabled={pristine || errorCount > 0}
          title={
            errorCount > 0
              ? `Resolve ${errorCount} validation error${errorCount === 1 ? '' : 's'} first`
              : pristine
                ? 'No unsaved changes to save'
                : 'Save configuration draft'
          }
          className={`flex h-[36px] items-center gap-1.5 rounded-[6px] border px-3.5 text-[13px] font-semibold text-white transition-all ${
            pristine || errorCount > 0
              ? 'cursor-not-allowed border-[#2f6fd0]/40 bg-[#13284a]/60 text-ink-faint'
              : 'border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] shadow-[0_0_16px_-4px_rgba(47,125,255,0.9)] hover:brightness-110'
          }`}
        >
          <Save size={14} strokeWidth={2.2} />
          <span className="hidden sm:inline">Save Changes</span>
        </button>

        {/* Apply */}
        <button
          type="button"
          onClick={onApply}
          disabled={pristine || errorCount > 0}
          title={
            errorCount > 0
              ? `Resolve ${errorCount} validation error${errorCount === 1 ? '' : 's'} first`
              : pristine
                ? 'No pending changes to apply'
                : 'Push draft to the live subsystems'
          }
          className={`flex h-[36px] items-center gap-1.5 rounded-[6px] border px-3.5 text-[13px] font-semibold text-white transition-all ${
            pristine || errorCount > 0
              ? 'cursor-not-allowed border-[#0e7490]/40 bg-[#0a2430]/50 text-ink-faint'
              : 'border-[#0e7490] bg-gradient-to-r from-[#0e7490] to-[#155e75] shadow-[0_0_16px_-4px_rgba(34,211,238,0.75)] hover:brightness-110'
          }`}
        >
          <Zap size={14} strokeWidth={2.2} />
          <span className="hidden md:inline">Apply Changes</span>
        </button>

        {/* Live system status indicator */}
        <div className="ml-1 flex h-[36px] items-center gap-2.5 rounded-[6px] border border-accent-green/30 bg-[#081c14] px-3">
          <span className="relative grid place-items-center text-[#4ade80]">
            <Activity size={15} />
            <span className="healthy-ping absolute inline-flex h-3 w-3 opacity-50" />
          </span>
          <div className="leading-tight">
            <div className="text-[12px] font-bold tracking-wide text-[#86efac]">
              All Systems Operational
            </div>
            <div className="mt-px text-3xs text-ink-faint">Uptime 31 d · last checked just now</div>
          </div>
        </div>
      </div>
    </div>
  );
}
