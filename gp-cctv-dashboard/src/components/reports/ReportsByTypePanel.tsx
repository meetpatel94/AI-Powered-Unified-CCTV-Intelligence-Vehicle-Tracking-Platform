import { useState } from 'react';

import { Panel } from '@/components/common/Panel';
import { reportsByType } from '@/data/reportsData';

/** REPORT ANALYTICS · horizontal bar chart of reports by type (30 d). */
export function ReportsByTypePanel() {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...reportsByType.map((slice) => slice.count));
  const total = reportsByType.reduce((acc, slice) => acc + slice.count, 0);

  return (
    <Panel
      title="Reports by Type"
      tools={<span className="tnum text-2xs uppercase tracking-[0.1em] text-ink-faint">30 days · {total}</span>}
      className="h-full"
      bodyClassName="flex flex-col justify-center gap-2 px-3.5 pb-3.5"
    >
      {reportsByType.map((slice) => {
        const active = hovered === slice.type;
        return (
          <div
            key={slice.type}
            onMouseEnter={() => setHovered(slice.type)}
            onMouseLeave={() => setHovered(null)}
            className="group cursor-default"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-[12px] transition-colors ${active ? 'text-white' : 'text-[#9fb0cc]'}`}>
                {slice.label}
              </span>
              <span className="tnum shrink-0 font-mono text-[11.5px] font-semibold" style={{ color: slice.color }}>
                {slice.count}
                <span className="ml-1 text-ink-faint">{Math.round((slice.count / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-[#111c30]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(slice.count / max) * 100}%`,
                  background: `linear-gradient(90deg, ${slice.color}cc, ${slice.color})`,
                  boxShadow: active ? `0 0 10px -1px ${slice.color}` : `0 0 6px -2px ${slice.color}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
