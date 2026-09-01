import { useState } from 'react';

import { formatIn, formatPct } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { EventTypeBar } from '@/types/analytics';

interface AiEventsByTypePanelProps {
  events: EventTypeBar[];
  total: number;
  windowNote: string;
}

/** Horizontal bars: Speed / Wrong Direction / Crowd / No Helmet / Signal Jump / Other. */
export function AiEventsByTypePanel({ events, total, windowNote }: AiEventsByTypePanelProps) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...events.map((bar) => bar.value));
  const ordered = [...events].sort((a, b) => b.value - a.value);

  return (
    <Panel
      title="AI Events by Type"
      action={
        <span className="tnum text-3xs text-ink-dim">
          {formatIn(total)} events · {windowNote}
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col justify-between px-3 pb-2 pt-1"
    >
      {ordered.map((bar, index) => {
        const pct = total > 0 ? (bar.value / total) * 100 : 0;
        const active = hover === bar.id;
        return (
          <div
            key={bar.id}
            onMouseEnter={() => setHover(bar.id)}
            onMouseLeave={() => setHover(null)}
            className="group"
            style={{ animationDelay: `${index * 40}ms` }}
            title={`${bar.label}: ${formatIn(bar.value)} (${formatPct(pct)})`}
          >
            <div className="mb-[3px] flex items-center justify-between gap-2">
              <span className={`truncate text-[9.5px] font-medium transition-colors ${active ? 'text-white' : 'text-[#9fb0cc]'}`}>
                {bar.label}
              </span>
              <span className="tnum shrink-0 text-[10px] font-bold text-white">
                {formatIn(bar.value)}
                <span className="ml-1 text-[8px] font-medium text-[#6d82a3]">{formatPct(pct, 0)}</span>
              </span>
            </div>
            <span className="relative block h-[11px] overflow-hidden rounded-[2px] bg-[#0d1626] ring-1 ring-inset ring-edge-soft">
              <span
                className="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-500"
                style={{
                  width: `${(bar.value / max) * 100}%`,
                  background: `linear-gradient(90deg, ${bar.color}55 0%, ${bar.color} 100%)`,
                  boxShadow: `0 0 10px -2px ${bar.color}`,
                  opacity: hover === null || active ? 1 : 0.35,
                }}
              />
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
