import { useState } from 'react';
import type { MouseEvent } from 'react';
import { TrendingUp } from 'lucide-react';

import { ChartTip } from '@/components/analytics/ChartTip';
import { formatIn, seriesToPoints, toArea, toLine } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { AnalyticsSnapshot } from '@/types/analytics';

interface VehicleDetectionTrendProps {
  snapshot: AnalyticsSnapshot;
  /**
   * Single-series "detections" legend chip. Redundant next to the panel title
   * on the Analytics page (hidden there); kept on by default for other pages.
   */
  showLegend?: boolean;
}

function ticksFor(max: number): number[] {
  const nice = max <= 2000 ? 500 : max <= 8000 ? 2000 : max <= 25000 ? 5000 : max <= 80000 ? 20000 : 100000;
  const top = Math.ceil(max / nice) * nice || nice;
  return [top, top * 0.75, top * 0.5, top * 0.25, 0].map((value) => Math.round(value));
}

function formatTick(value: number): string {
  if (value >= 100000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return String(value);
}

/** Large area chart of vehicle detections over the selected window. */
export function VehicleDetectionTrend({ snapshot, showLegend = true }: VehicleDetectionTrendProps) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const values = snapshot.vehicleTrend.map((point) => point.value);
  const max = Math.max(1, ...values, snapshot.peakValue);
  const yTicks = ticksFor(max);
  const yMax = yTicks[0];
  const points = seriesToPoints(values, yMax);
  const line = toLine(points);
  const area = toArea(points);
  const labelEvery = snapshot.vehicleTrend.length > 16 ? 4 : snapshot.vehicleTrend.length > 10 ? 2 : 1;
  const active = hover === null ? null : snapshot.vehicleTrend[hover.index];

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (snapshot.vehicleTrend.length === 0 || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (snapshot.vehicleTrend.length - 1));
    setHover({ index, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <Panel
      title="Vehicle Detection Trend"
      action={
        <span className="flex items-center gap-1 text-3xs text-accent-cyan">
          <TrendingUp size={10} strokeWidth={2.4} />
          peak {snapshot.vehicleTrendUnit === 'hour' ? `${snapshot.peakLabel}:00` : snapshot.peakLabel} · {formatIn(snapshot.peakValue)}
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10.5px] text-[#6d82a3]">
        <span className="min-w-0 truncate">{snapshot.windowNote}</span>
        {showLegend ? (
          <span className="flex shrink-0 items-center gap-1">
            <span className="h-1.5 w-3 rounded-sm bg-accent-cyan" /> detections
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5">
        <div className="flex w-[28px] shrink-0 flex-col justify-between pb-[16px] pt-[6px] text-right text-[10px] tabular-nums text-[#6d82a3]">
          {yTicks.map((tick) => (
            <span key={tick}>{formatTick(tick)}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 bottom-[16px] top-[6px] flex flex-col justify-between">
            {yTicks.map((tick) => (
              <div key={tick} className="h-px w-full" style={{ background: '#14243c' }} />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-[16px] top-[6px]">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="an-veh-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2f7dff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#an-veh-area)" />
              <polyline
                points={line}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.7}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.55))' }}
              />
            </svg>

            {hover !== null && points[hover.index] ? (
              <span
                className="pointer-events-none absolute top-0 w-px bg-accent-cyan/40"
                style={{ left: `${points[hover.index].x}%`, height: '100%' }}
              />
            ) : null}

            {points.map((point, index) => {
              const isPeak = snapshot.vehicleTrend[index].value === snapshot.peakValue;
              const isHover = hover?.index === index;
              return (
                <span
                  key={snapshot.vehicleTrend[index].label + index}
                  className={`absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    isPeak || isHover ? 'bg-white shadow-[0_0_6px_rgba(34,211,238,0.9)]' : 'bg-accent-cyan'
                  }`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                />
              );
            })}

          </div>

          {active && hover ? (
            <ChartTip
              visible
              x={hover.x}
              y={hover.y}
              title={
                snapshot.vehicleTrendUnit === 'hour'
                  ? `${active.label}:00 IST`
                  : `${active.label} · ${snapshot.rangeLabel}`
              }
              rows={[{ label: 'Vehicles', value: formatIn(active.value), color: '#22d3ee' }]}
            />
          ) : null}

          {/* Equal-width centered slots keep dense hour/day labels from colliding. */}
          <div className="absolute inset-x-0 bottom-0 flex h-[16px] items-center">
            {snapshot.vehicleTrend.map((point, index) => (
              <span
                key={`${point.label}-${index}`}
                className={`tnum min-w-0 flex-1 text-center text-[9.5px] text-[#8ea1c0] ${index % labelEvery !== 0 ? 'opacity-0' : ''}`}
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
