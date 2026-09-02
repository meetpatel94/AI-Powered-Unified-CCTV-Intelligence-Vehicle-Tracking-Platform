import { Check, LoaderCircle } from 'lucide-react';

import { buildApplySteps } from '@/components/settings/applyRunbook';

export interface ApplyProgressModalProps {
  open: boolean;
  /** Subsystem ids receiving the new configuration. */
  subsystems: string[];
  changeCount: number;
  step: number; // -1 idle, 0..steps.length running, steps.length done
  onClose: () => void;
}

/** Modal that animates a staged configuration rollout across subsystems. */
export function ApplyProgressModal({ open, subsystems, changeCount, step, onClose }: ApplyProgressModalProps) {
  if (!open) return null;

  const steps = buildApplySteps(subsystems);
  const done = step >= steps.length;
  const runningIdx = Math.min(Math.max(step, 0), steps.length - 1);

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-[#02040a]/85 p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel w-full max-w-[520px] overflow-hidden border border-accent-cyan/30 animate-drawer-in"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Applying configuration"
      >
        <div className="relative overflow-hidden border-b border-edge/70 bg-panel-head px-4 py-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <span className="scan-sweep block h-full w-1/3 bg-gradient-to-r from-transparent via-accent-cyan to-transparent" />
          </div>
          <div className="flex items-center gap-2.5">
            {done ? (
              <span className="grid h-8 w-8 place-items-center rounded-full border border-accent-green/50 bg-[#0b2e26]">
                <Check size={15} className="text-[#4ade80]" strokeWidth={2.6} />
              </span>
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full border border-accent-cyan/50 bg-[#082a36]">
                <LoaderCircle size={15} className="animate-spin text-accent-cyan" />
              </span>
            )}
            <div>
              <h2 className="text-[13.5px] font-bold uppercase tracking-[0.1em] text-white">
                {done ? 'Configuration live' : 'Applying changes'}
              </h2>
              <p className="mt-px text-[11.5px] text-ink-dim">
                {done
                  ? `Pushed ${changeCount} change${changeCount === 1 ? '' : 's'} across ${subsystems.length} subsystem${subsystems.length === 1 ? '' : 's'}`
                  : `Rolling ${changeCount} change${changeCount === 1 ? '' : 's'} to the control plane…`}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 px-4 py-3.5">
          {steps.map((stepDef, index) => {
            const status = step >= steps.length || index < step ? 'done' : index === runningIdx && step >= 0 ? 'active' : 'idle';
            const Icon = stepDef.icon;
            return (
              <div
                key={stepDef.id}
                className={`flex items-center gap-3 rounded-[6px] border px-3 py-2 transition-all ${
                  status === 'active'
                    ? 'border-accent-cyan/40 bg-[#082a36]'
                    : status === 'done'
                      ? 'border-accent-green/25 bg-[#081c14]/70'
                      : 'border-edge/70 bg-[#0a1120]/60'
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                    status === 'done'
                      ? 'border-accent-green/50 bg-[#0b2e26] text-[#4ade80]'
                      : status === 'active'
                        ? 'border-accent-cyan/60 bg-[#0e4a5c] text-accent-cyan'
                        : 'border-edge bg-[#101a2e] text-ink-faint'
                  }`}
                >
                  {status === 'done' ? (
                    <Check size={12} strokeWidth={3} />
                  ) : status === 'active' ? (
                    <LoaderCircle size={12} className="animate-spin" />
                  ) : (
                    <Icon size={12} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[12px] font-semibold ${status === 'idle' ? 'text-ink-dim' : 'text-[#e6edf7]'}`}>
                      {stepDef.label}
                    </span>
                    {status === 'active' ? (
                      <span className="text-[9.5px] font-bold uppercase tracking-widest text-accent-cyan animate-pulse-dot">working</span>
                    ) : status === 'done' ? (
                      <span className="text-[9.5px] font-bold uppercase tracking-widest text-[#6fe0b0]">done</span>
                    ) : null}
                  </div>
                  <p className="truncate text-[10.5px] text-ink-faint">{stepDef.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-edge/70 bg-panel-head px-4 py-2.5">
          <span className="text-[10.5px] uppercase tracking-wider text-ink-faint">
            {done ? 'Subsystem health verified · 100%' : 'Estimated 3–5 seconds'}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={!done}
            className={`flex h-[30px] items-center rounded-[5px] border px-3.5 text-[12px] font-semibold transition-all ${
              done
                ? 'border-accent-green/50 bg-gradient-to-r from-[#15803d] to-[#166534] text-white hover:brightness-110'
                : 'cursor-not-allowed border-edge bg-panel text-ink-faint'
            }`}
          >
            {done ? 'Done' : 'Applying…'}
          </button>
        </div>
      </div>
    </div>
  );
}
