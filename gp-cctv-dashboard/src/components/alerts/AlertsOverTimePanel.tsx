import { TrendingUp } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { alertsOverTime } from '@/data/alertsData';

/** Bottom row 2: hourly alert volume for the rolling 12 h ending at the reference clock. */
export function AlertsOverTimePanel({
  series = alertsOverTime,
  peakLabel,
}: {
  series?: Array<{ label: string; value: number }>;
  peakLabel?: string;
}) {
  const data = series.length > 1 ? series : alertsOverTime;
  const max = Math.max(14, ...data.map((p) => p.value));
  const step = Math.max(1, Math.round(max / 4));
  const TICKS = [max, max - step, max - 2 * step, Math.max(1, max - 3 * step), 0];
  const points = data.map((point, index) => ({
    x: (index / (data.length - 1)) * 100,
    y: 100 - (point.value / max) * 100,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `0,100 ${line} 100,100`;
  const last = data[data.length - 1];
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  return (
    <Panel
      title="Alerts Over Time"
      action={
        <span className="flex items-center gap-1 text-3xs text-accent-cyan">
          <TrendingUp size={10} strokeWidth={2.4} />
          {peakLabel ?? `peak ${peak.label} · ${peak.value} event${peak.value === 1 ? '' : 's'}`}
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="flex h-full min-h-0 gap-1.5">
        <div className="flex w-[18px] shrink-0 flex-col justify-between pb-[16px] pt-[6px] text-right text-[10px] tabular-nums text-[#6d82a3]">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-[16px] top-[6px] flex flex-col justify-between">
            {TICKS.map((tick) => (
              <div key={tick} className="h-px w-full" style={{ background: '#14243c' }} />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-[16px] top-[6px]">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="alrt-time-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f7dff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#2f7dff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#alrt-time-area)" />
              <polyline
                points={line}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.55))' }}
              />
            </svg>

            {points.map((point, index) => (
              <span
                key={data[index].label}
                title={`${data[index].value} alerts`}
                className={`absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  index === points.length - 1 ? 'bg-white shadow-[0_0_6px_rgba(34,211,238,0.9)]' : 'bg-accent-cyan'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ))}

            <span
              className="tnum absolute -translate-x-full -translate-y-[130%] rounded-[3px] border border-accent-cyan/40 bg-[#083344]/90 px-1 py-px text-[10.5px] font-bold text-[#67e8f9]"
              style={{ left: '100%', top: `${points[points.length - 1].y}%` }}
            >
              {last.value}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[16px] items-center justify-between px-0.5">
            {data.map((point, index) => (
              <span
                key={point.label}
                className={`text-[9.5px] text-[#8ea1c0] ${index % 2 === 1 && index !== data.length - 1 ? 'opacity-0' : ''}`}
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
