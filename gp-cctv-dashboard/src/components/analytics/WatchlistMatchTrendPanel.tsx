import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { ShieldAlert } from 'lucide-react';

import { ChartTip } from '@/components/analytics/ChartTip';
import { formatIn, seriesToPoints, toArea, toLine } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { WatchlistTrendPoint } from '@/types/analytics';

interface WatchlistMatchTrendPanelProps {
  series: WatchlistTrendPoint[];
  windowNote: string;
}

/** Dual series: daily watchlist matches (cyan area) + critical events (red line). */
export function WatchlistMatchTrendPanel({ series, windowNote }: WatchlistMatchTrendPanelProps) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const max = Math.max(1, ...series.map((point) => point.matches), 4);
  const matchPts = useMemo(() => seriesToPoints(series.map((p) => p.matches), max), [series, max]);
  const critPts = useMemo(() => seriesToPoints(series.map((p) => p.critical), max), [series, max]);
  const labelEvery = series.length > 16 ? 4 : series.length > 10 ? 2 : 1;
  const ticks = [max, Math.round(max * 0.5), 0];

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (series.length === 0 || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover({
      index: Math.round(ratio * (series.length - 1)),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const active = hover === null ? null : series[hover.index];

  return (
    <Panel
      title="Watchlist Match Trend"
      action={
        <span className="flex items-center gap-1 text-3xs text-[#ff8b96]">
          <ShieldAlert size={10} />
          {formatIn(series.reduce((acc, point) => acc + point.critical, 0))} critical
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="mb-1 flex items-center justify-between text-[8.5px] text-[#6d82a3]">
        <span>{windowNote}</span>
        <span className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-sm bg-accent-cyan" /> matches
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-sm bg-accent-red" /> critical
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5">
        <div className="flex w-[18px] shrink-0 flex-col justify-between pb-[16px] pt-[6px] text-right text-[8px] tabular-nums text-[#6d82a3]">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 bottom-[16px] top-[6px] flex flex-col justify-between">
            {ticks.map((tick) => (
              <div key={tick} className="h-px w-full" style={{ background: '#14243c' }} />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-[16px] top-[6px]">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="an-wl-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={toArea(matchPts)} fill="url(#an-wl-area)" />
              <polyline
                points={toLine(matchPts)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.5))' }}
              />
              <polyline
                points={toLine(critPts)}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.55))' }}
              />
            </svg>

            {matchPts.map((point, index) => (
              <span
                key={`m-${series[index].label}-${index}`}
                className={`absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  hover?.index === index ? 'bg-white shadow-[0_0_6px_rgba(34,211,238,0.9)]' : 'bg-accent-cyan'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ))}

          </div>

          {active && hover ? (
            <ChartTip
              visible
              x={hover.x}
              y={hover.y}
              title={active.label}
              rows={[
                { label: 'Matches', value: formatIn(active.matches), color: '#22d3ee' },
                { label: 'Critical', value: formatIn(active.critical), color: '#ef4444' },
              ]}
            />
          ) : null}

          <div className="absolute inset-x-0 bottom-0 flex h-[16px] items-center justify-between px-0.5">
            {series.map((point, index) => (
              <span
                key={`${point.label}-${index}`}
                className={`tnum text-[7.5px] text-[#8ea1c0] ${index % labelEvery !== 0 ? 'opacity-0' : ''}`}
              >
                {point.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
