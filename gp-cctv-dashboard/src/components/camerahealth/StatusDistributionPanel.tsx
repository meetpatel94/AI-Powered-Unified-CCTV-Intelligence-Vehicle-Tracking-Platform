import { useMemo } from 'react';

import { Panel } from '@/components/common/Panel';
import { statusSlices } from '@/data/cameraHealthData';

import type { FleetHealth } from '@/types/cameraHealth';

const RADIUS = 46;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * CAMERA STATUS DISTRIBUTION — donut of the three primary fleet buckets
 * (Online / Offline / Poor Signal) plus the live sub-state callouts for
 * Reconnecting and Critical, which sit inside those buckets.
 */
export function StatusDistributionPanel({ fleet, onSelect, active }: { fleet: FleetHealth; onSelect: (id: string) => void; active: string }) {
  const slices = useMemo(() => statusSlices(fleet), [fleet]);
  const primary = slices.filter((slice) => !slice.subsetOf);
  const subsets = slices.filter((slice) => slice.subsetOf);

  const arcs = primary.reduce<Array<{ slice: (typeof primary)[number]; length: number; offset: number }>>(
    (acc, slice) => {
      const length = (slice.count / fleet.total) * CIRC;
      const offset = acc.reduce((sum, arc) => sum + arc.length, 0);
      return [...acc, { slice, length, offset }];
    },
    [],
  );

  return (
    <Panel title="Camera Status Distribution" className="h-full min-h-0" bodyClassName="flex min-h-0 items-center gap-3 px-2.5 pb-2.5">
      <div className="relative h-[122px] w-[122px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#111c30" strokeWidth="13" />
          {arcs.map(({ slice, length, offset: dashOffset }) => (
            <circle
              key={slice.id}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth="13"
              strokeDasharray={`${Math.max(0, length - 1.4)} ${CIRC}`}
              strokeDashoffset={-dashOffset}
              strokeLinecap="butt"
              opacity={active === 'all' || active === slice.id ? 1 : 0.35}
              style={{ transition: 'opacity 200ms ease' }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="tnum text-[17px] font-bold leading-none text-white">{fleet.total.toLocaleString('en-IN')}</div>
            <div className="mt-[2px] text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">cameras</div>
            <div className="tnum mt-1 font-mono text-[11px] text-[#6fe0b0]">
              {primary[0]?.whole ?? 0}% up
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
        {primary.map((slice) => {
          const selected = active === slice.id;
          return (
            <button
              key={slice.id}
              type="button"
              onClick={() => onSelect(selected ? 'all' : slice.id)}
              title={`Filter the monitor grid to ${slice.label.toLowerCase()} cameras`}
              className={`flex items-center gap-2 rounded-[4px] border px-1.5 py-1 text-left transition-colors ${
                selected ? 'border-edge-strong bg-panel-hover' : 'border-transparent hover:bg-panel-hover/60'
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: slice.color, boxShadow: `0 0 6px -1px ${slice.color}` }} />
              <span className="flex-1 truncate text-[12px] text-[#c3cfe2]">{slice.label}</span>
              <span className="tnum font-mono text-[12.5px] font-semibold text-white">{slice.count.toLocaleString('en-IN')}</span>
              <span className="tnum w-[34px] text-right font-mono text-[11.5px] text-ink-faint">{slice.whole}%</span>
            </button>
          );
        })}

        <div className="mt-0.5 space-y-1 border-t border-edge-soft pt-1.5">
          {subsets.map((slice) => (
            <button
              key={slice.id}
              type="button"
              onClick={() => onSelect(active === slice.id ? 'all' : slice.id)}
              title={`${slice.count} of the ${slice.subsetOf} bucket · currently ${slice.label.toLowerCase()}`}
              className={`flex w-full items-center gap-2 rounded-[4px] border px-1.5 py-[3px] text-left transition-colors ${
                active === slice.id ? 'border-edge-strong bg-panel-hover' : 'border-transparent hover:bg-panel-hover/60'
              }`}
            >
              <span className="relative h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }}>
                <span className="absolute inset-0 rounded-full animate-ping2" style={{ backgroundColor: slice.color }} />
              </span>
              <span className="flex-1 truncate text-[11.5px] text-ink-dim">{slice.label}</span>
              <span className="tnum font-mono text-[12px] font-semibold" style={{ color: slice.color }}>
                {slice.count}
              </span>
              <span className="w-[92px] truncate text-right font-mono text-[10px] text-ink-faint">of {slice.subsetOf}</span>
            </button>
          ))}
        </div>

        <p className="mt-0.5 text-[10.5px] leading-[12px] text-ink-faint">
          Reconnecting and Critical are live sub-states, not extra cameras — the three bars above partition the full fleet.
        </p>
      </div>
    </Panel>
  );
}
