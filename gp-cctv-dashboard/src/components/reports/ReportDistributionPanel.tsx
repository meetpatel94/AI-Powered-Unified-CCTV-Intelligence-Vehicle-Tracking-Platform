import { useState } from 'react';

import { Panel } from '@/components/common/Panel';
import { reportDistribution } from '@/data/reportsData';

const R = 34;
const CIRC = 2 * Math.PI * R;

/** REPORT ANALYTICS · alert / vehicle / watchlist distribution donut. */
export function ReportDistributionPanel() {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = reportDistribution.reduce((acc, slice) => acc + slice.count, 0);

  const cumulative = reportDistribution.map((_, index) =>
    reportDistribution.slice(0, index).reduce((acc, prev) => acc + (prev.percent / 100) * CIRC, 0),
  );
  const arcs = reportDistribution.map((slice, index) => {
    const length = (slice.percent / 100) * CIRC;
    return { ...slice, dash: `${length} ${CIRC - length}`, offset: -cumulative[index] };
  });

  const active = reportDistribution.find((slice) => slice.id === hovered) ?? null;

  return (
    <Panel
      title="Report Distribution"
      tools={<span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">alert · vehicle · watchlist</span>}
      className="h-full"
      bodyClassName="flex items-center gap-4 px-3.5 pb-3.5"
    >
      <div className="relative h-[128px] w-[128px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#111c30" strokeWidth="11" />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={hovered === arc.id ? 13 : 11}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              onMouseEnter={() => setHovered(arc.id)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer transition-all duration-300"
              style={{ filter: hovered === arc.id ? `drop-shadow(0 0 4px ${arc.color})` : undefined }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="tnum text-[20px] font-bold leading-none text-white">
              {active ? `${active.percent}%` : total}
            </div>
            <div className="mt-1 text-3xs uppercase tracking-[0.08em] text-ink-faint">
              {active ? active.label.replace(' Reports', '') : 'documents'}
            </div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5">
        {reportDistribution.map((slice) => (
          <li
            key={slice.id}
            onMouseEnter={() => setHovered(slice.id)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-default"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#9fb0cc]">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: slice.color, boxShadow: `0 0 6px ${slice.color}88` }}
                />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="tnum shrink-0 font-mono text-[11.5px] font-semibold text-white">
                {slice.count}
                <span className="ml-1 text-ink-faint">{slice.percent}%</span>
              </span>
            </div>
            <div className="ml-3.5 mt-1 h-[4px] overflow-hidden rounded-full bg-[#111c30]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${slice.percent}%`, background: slice.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
