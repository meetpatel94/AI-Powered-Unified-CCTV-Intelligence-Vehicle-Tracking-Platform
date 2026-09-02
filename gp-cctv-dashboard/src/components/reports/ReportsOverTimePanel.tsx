import { useRef, useState } from 'react';

import { ChartTip } from '@/components/analytics/ChartTip';
import { seriesToPoints, toArea, toLine } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import { reportsTrend } from '@/data/reportsData';

/** REPORT ANALYTICS · 14-day generated vs scheduled line chart. */
export function ReportsOverTimePanel() {
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const max = Math.max(...reportsTrend.map((point) => Math.max(point.generated, point.scheduled))) + 2;
  const generated = seriesToPoints(reportsTrend.map((point) => point.generated), max);
  const scheduled = seriesToPoints(reportsTrend.map((point) => point.scheduled), max);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(
      reportsTrend.length - 1,
      Math.max(0, Math.round(ratio * (reportsTrend.length - 1))),
    );
    setHover({
      index,
      x: (index / (reportsTrend.length - 1)) * rect.width,
      y: (generated[index].y / 100) * rect.height,
    });
  };

  const hovered = hover ? reportsTrend[hover.index] : null;

  return (
    <Panel
      title="Reports Generated Over Time"
      tools={
        <span className="flex items-center gap-3 text-2xs text-ink-faint">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-[0_0_6px_#22d3ee]" /> Generated
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" /> Scheduled runs
          </span>
        </span>
      }
      className="h-full"
      bodyClassName="flex flex-col px-3.5 pb-3"
    >
      <div
        ref={plotRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="relative min-h-[150px] flex-1"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="rpt-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((offset) => (
            <line key={offset} x1="0" x2="100" y1={offset} y2={offset} stroke="#12203a" strokeWidth="0.4" />
          ))}
          <polygon points={toArea(generated)} fill="url(#rpt-trend-fill)" />
          <polyline
            points={toLine(scheduled)}
            fill="none"
            stroke="#2f7dff"
            strokeWidth="1"
            strokeDasharray="2.4 2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          <polyline
            points={toLine(generated)}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.65))' }}
          />
          {hover ? (
            <line
              x1={(hover.index / (reportsTrend.length - 1)) * 100}
              x2={(hover.index / (reportsTrend.length - 1)) * 100}
              y1="0"
              y2="100"
              stroke="#3b5f9e"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {hover ? (
          <span
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#05070f] bg-accent-cyan shadow-[0_0_8px_#22d3ee]"
            style={{ left: hover.x, top: hover.y }}
          />
        ) : null}

        <ChartTip
          visible={Boolean(hover && hovered)}
          x={hover?.x ?? 0}
          y={hover?.y ?? 0}
          title={hovered?.label ?? ''}
          rows={
            hovered
              ? [
                  { label: 'Generated', value: String(hovered.generated), color: '#22d3ee' },
                  { label: 'Scheduled', value: String(hovered.scheduled), color: '#2f7dff' },
                ]
              : []
          }
        />
      </div>

      <div className="mt-1 flex justify-between text-3xs text-ink-faint">
        {reportsTrend
          .filter((_, index) => index % 2 === 0)
          .map((point) => (
            <span key={point.label} className="tnum font-mono">
              {point.label}
            </span>
          ))}
      </div>
    </Panel>
  );
}
