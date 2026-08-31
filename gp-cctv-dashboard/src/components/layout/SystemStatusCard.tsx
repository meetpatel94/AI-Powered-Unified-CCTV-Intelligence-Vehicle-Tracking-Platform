import { systemStatus } from '@/data/mockData';
import type { SystemState } from '@/types';

const stateStyles: Record<SystemState, string> = {
  operational: 'bg-accent-green/12 text-accent-green ring-accent-green/30',
  good: 'bg-accent-green/12 text-accent-green ring-accent-green/30',
  degraded: 'bg-accent-orange/12 text-accent-orange ring-accent-orange/30',
  down: 'bg-accent-red/12 text-accent-red ring-accent-red/30',
};

/** Compact operational health readout pinned to the bottom of the sidebar. */
export function SystemStatusCard() {
  return (
    <div className="rounded-[5px] border border-edge-soft bg-panel/80 px-2 py-2">
      <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-dim">
        System Status
      </div>
      <ul className="space-y-[5px]">
        {systemStatus.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-1">
            <span className="truncate text-[9.5px] text-[#8a9ab8]">{item.label}</span>
            <span
              className={`flex items-center gap-1 rounded-[3px] px-1.5 py-[2px] text-3xs font-medium ring-1 ${stateStyles[item.state]}`}
            >
              {item.state === 'good' && (
                <span className="h-1 w-1 rounded-full bg-accent-green animate-pulse-dot" />
              )}
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
