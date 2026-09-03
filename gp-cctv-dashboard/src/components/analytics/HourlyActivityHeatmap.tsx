import { useState } from 'react';

import { ChartTip } from '@/components/analytics/ChartTip';
import { formatIn } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { HeatmapGrid } from '@/types/analytics';

interface HourlyActivityHeatmapProps {
  grid: HeatmapGrid;
}

function heatColor(t: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [11, 21, 40]],
    [0.18, [16, 48, 84]],
    [0.38, [29, 108, 224]],
    [0.55, [34, 211, 238]],
    [0.72, [234, 179, 8]],
    [0.86, [245, 158, 11]],
    [1, [239, 68, 68]],
  ];
  const clamped = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < stops.length - 1 && clamped > stops[i + 1][0]) i += 1;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const span = b[0] - a[0] || 1;
  const u = (clamped - a[0]) / span;
  const rgb = a[1].map((ch, idx) => Math.round(ch + (b[1][idx] - ch) * u));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** 7-day × 24-hour detection intensity heatmap. */
export function HourlyActivityHeatmap({ grid }: HourlyActivityHeatmapProps) {
  const [hover, setHover] = useState<{ day: number; hour: number; x: number; y: number } | null>(null);
  const max = Math.max(1, grid.max);
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <Panel
      title="Hourly Activity"
      action={<span className="tnum text-3xs text-ink-dim">26 Aug – 01 Sep · 24 h intensity</span>}
      className="h-full min-h-0"
      bodyClassName="relative flex min-h-0 flex-col px-3 pb-2 pt-1"
    >
      <div className="mb-1 flex items-center justify-between text-[10px] text-[#6d82a3]">
        <span>Detection intensity across 24 hours</span>
        <span className="flex items-center gap-1">
          <span className="text-[#6d82a3]">low</span>
          <span className="flex h-[6px] w-[72px] overflow-hidden rounded-full">
            {[0, 0.2, 0.4, 0.55, 0.7, 0.85, 1].map((t) => (
              <span key={t} className="flex-1" style={{ background: heatColor(t) }} />
            ))}
          </span>
          <span className="text-[#ff8b96]">high</span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1" data-heat-root>
        <div className="flex h-full min-h-0">
          <div className="flex w-[52px] shrink-0 flex-col justify-between py-[2px] pr-1.5">
            {grid.days.map((day) => (
              <span key={day} className="tnum text-right text-[10px] leading-none text-[#7f92b3]">
                {day}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
              {grid.cells.map((row, day) => (
                <div key={grid.dayKeys[day]} className="flex min-h-0 flex-1 gap-[2px]">
                  {row.map((value, hour) => {
                    const t = value / max;
                    const active = hover?.day === day && hover?.hour === hour;
                    return (
                      <button
                        key={`${day}-${hour}`}
                        type="button"
                        onMouseEnter={(event) => {
                          const root = event.currentTarget.closest('[data-heat-root]');
                          const rect =
                            root instanceof HTMLElement
                              ? root.getBoundingClientRect()
                              : event.currentTarget.getBoundingClientRect();
                          setHover({
                            day,
                            hour,
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                        title={`${grid.dayKeys[day]} · ${String(hour).padStart(2, '0')}:00 · ${formatIn(value)} vehicles`}
                        className={`min-w-0 flex-1 rounded-[2px] transition-transform ${active ? 'scale-[1.18] ring-1 ring-white/70' : ''}`}
                        style={{
                          background: heatColor(t),
                          boxShadow: t > 0.75 ? `0 0 6px -1px ${heatColor(t)}` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-1 flex h-[12px] items-center">
              {grid.hours.map((hour) => (
                <span
                  key={hour}
                  className={`tnum min-w-0 flex-1 text-center text-[9.5px] text-[#6d82a3] ${
                    hourLabels.includes(hour) ? '' : 'opacity-0'
                  }`}
                >
                  {String(hour).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {hover ? (
          /* Anchored at the actual hovered cell (pointer position relative to
             the heat root) instead of a hardcoded plot size, so the tooltip
             never lands on the wrong cells at other panel widths. */
          <ChartTip
            visible
            x={hover.x}
            y={hover.y}
            title={`${grid.dayKeys[hover.day]} · ${String(hover.hour).padStart(2, '0')}:00`}
            rows={[{ label: 'Detections', value: formatIn(grid.cells[hover.day][hover.hour]), color: '#22d3ee' }]}
          />
        ) : null}
      </div>
    </Panel>
  );
}
