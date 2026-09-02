import { useState } from 'react';

import { formatIn, formatPct } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { VehicleTypeSlice } from '@/types/analytics';

interface VehicleTypesPanelProps {
  types: VehicleTypeSlice[];
  total: number;
  windowNote: string;
}

/** Donut + legend mix of Cars / Two Wheelers / Heavy Vehicles / Buses. */
export function VehicleTypesPanel({ types, total, windowNote }: VehicleTypesPanelProps) {
  const [hover, setHover] = useState<number | null>(null);
  const denom = Math.max(1, total);
  const radius = 15.9155;
  const pcts = types.map((slice) => (slice.value / denom) * 100);
  const offsets = pcts.map((_, index) => 25 - pcts.slice(0, index).reduce((acc, pct) => acc + pct, 0));
  const active = hover === null ? null : types[hover];

  return (
    <Panel
      title="Vehicle Types"
      action={<span className="tnum text-3xs text-ink-dim">{windowNote}</span>}
      className="h-full min-h-0"
      bodyClassName="flex h-full min-h-0 flex-col px-3 pb-2 pt-0.5"
    >
      <div className="flex min-h-0 flex-1 items-center gap-3">
        <div className="relative h-[118px] w-[118px] shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full">
            <circle cx="21" cy="21" r={radius} fill="none" stroke="#0d1626" strokeWidth="4.6" />
            {types.map((slice, index) => {
              const pct = pcts[index];
              const dash = `${Math.max(0, pct - 1.2)} ${100 - Math.max(0, pct - 1.2)}`;
              return (
                <circle
                  key={slice.id}
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={hover === index ? 5.8 : 4.6}
                  strokeDasharray={dash}
                  strokeDashoffset={offsets[index]}
                  transform="rotate(-90 21 21)"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    opacity: hover === null || hover === index ? 1 : 0.28,
                    transition: 'opacity 150ms ease, stroke-width 150ms ease',
                    filter: hover === index ? `drop-shadow(0 0 5px ${slice.color})` : undefined,
                    cursor: 'default',
                  }}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center leading-none">
            <div>
              <div className="tnum text-[15px] font-bold text-white">{active ? formatIn(active.value) : formatIn(total)}</div>
              <div className="mt-[2px] max-w-[72px] truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6d82a3]">
                {active ? active.label : 'vehicles'}
              </div>
            </div>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-[5px]">
          {types.map((slice, index) => {
            const pct = (slice.value / denom) * 100;
            return (
              <li
                key={slice.id}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                className={`rounded-[4px] px-1 py-[2px] transition-colors ${hover === index ? 'bg-panel-hover' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: slice.color, boxShadow: `0 0 6px -1px ${slice.color}` }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#9fb0cc]">{slice.label}</span>
                  <span className="tnum text-[12px] font-bold text-white">{formatIn(slice.value)}</span>
                </div>
                <div className="mt-[3px] ml-3.5 h-[3px] overflow-hidden rounded-full bg-[#0d1626]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, background: slice.color, boxShadow: `0 0 8px -2px ${slice.color}` }}
                  />
                </div>
                <div className="ml-3.5 mt-[1px] tnum text-[10px] text-[#6d82a3]">{formatPct(pct)}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
