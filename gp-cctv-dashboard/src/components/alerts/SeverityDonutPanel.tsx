import { useState } from 'react';

import { Panel } from '@/components/common/Panel';
import type { AlertKpis } from '@/data/alertsData';
import type { AlertRecord } from '@/types/alerts';

const slices: Array<{ key: 'critical' | 'high' | 'medium' | 'info'; label: string; color: string }> = [
  { key: 'critical', label: 'Critical', color: '#ef4444' },
  { key: 'high', label: 'High', color: '#f59e0b' },
  { key: 'medium', label: 'Medium', color: '#eab308' },
  { key: 'info', label: 'Info / Low', color: '#2f7dff' },
];

interface SeverityDonutPanelProps {
  alerts: AlertRecord[];
  kpis: AlertKpis;
}

/** Bottom row 3: severity mix for the current shift, donut + legend. */
export function SeverityDonutPanel({ alerts, kpis }: SeverityDonutPanelProps) {
  const [hover, setHover] = useState<number | null>(null);
  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };
  const total = Math.max(1, kpis.total);

  const radius = 15.9155; // circumference ≈ 100 → dasharray works in %
  const pcts = slices.map((slice) => (counts[slice.key] / total) * 100);
  // start at 12 o'clock; each following segment begins after the previous ones
  const offsets = pcts.map((_, index) => 25 - pcts.slice(0, index).reduce((acc, pct) => acc + pct, 0));

  return (
    <Panel
      title="Severity Distribution"
      action={<span className="tnum text-3xs text-ink-dim">this shift</span>}
      className="h-full min-h-0"
      bodyClassName="flex h-full min-h-0 items-center gap-3 px-3 pb-2 pt-0.5"
    >
      <div className="relative h-[104px] w-[104px] shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-0">
          <circle cx="21" cy="21" r={radius} fill="none" stroke="#0d1626" strokeWidth="4.4" />
          {slices.map((slice, index) => {
            const pct = pcts[index];
            const dash = `${Math.max(0, pct - 1.4)} ${100 - Math.max(0, pct - 1.4)}`;
            const strokeOffset = offsets[index];
            return (
              <circle
                key={slice.key}
                cx="21"
                cy="21"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={hover === index ? 5.6 : 4.4}
                strokeDasharray={dash}
                strokeDashoffset={strokeOffset}
                strokeLinecap="butt"
                transform="rotate(-90 21 21)"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                style={{
                  opacity: hover === null || hover === index ? 1 : 0.35,
                  transition: 'opacity 150ms ease, stroke-width 150ms ease',
                  filter: hover === index ? `drop-shadow(0 0 5px ${slice.color})` : undefined,
                }}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center leading-none">
          <div>
            <div className="tnum text-[19px] font-bold text-white">{total}</div>
            <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-[#6d82a3]">alerts</div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-[5px]">
        {slices.map((slice, index) => {
          const value = counts[slice.key];
          const pct = Math.round((value / total) * 100);
          return (
            <li
              key={slice.key}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              className={`flex cursor-default items-center gap-1.5 rounded-[4px] px-1.5 py-[2.5px] transition-colors ${
                hover === index ? 'bg-panel-hover' : ''
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: slice.color, boxShadow: `0 0 6px -1px ${slice.color}` }} />
              <span className="min-w-0 flex-1 truncate text-[9.5px] text-[#9fb0cc]">{slice.label}</span>
              <span className="tnum text-[10px] font-bold text-white">{value}</span>
              <span className="tnum w-[34px] text-right text-[8.5px] text-[#6d82a3]">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
