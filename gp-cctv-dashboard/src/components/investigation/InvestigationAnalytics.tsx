import { BarChart3, Camera as CameraIcon, MapPin, PieChart, TrendingUp } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { InvestigationAnalytics } from '@/types/investigation';

/* ------------------------------------------------------------------ *
 * Sightings over time
 * ------------------------------------------------------------------ */

interface SightingsOverTimePanelProps {
  analytics: InvestigationAnalytics;
  bucketLabel: string;
}

/** Bottom analytics 1: sightings per bucket across the investigation window. */
export function SightingsOverTimePanel({ analytics, bucketLabel }: SightingsOverTimePanelProps) {
  const { buckets, peak } = analytics;
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const points = buckets.map((bucket, index) => ({
    x: buckets.length > 1 ? (index / (buckets.length - 1)) * 100 : 50,
    y: 100 - (bucket.value / max) * 100,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `0,100 ${line} 100,100`;
  const ticks = [max, Math.round(max * 0.5), 0];

  return (
    <Panel
      title="Sightings Over Time"
      tools={
        <span className="flex items-center gap-1 text-3xs text-accent-cyan">
          <TrendingUp size={10} strokeWidth={2.4} />
          peak {peak.label} · {peak.value} reads
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="flex h-full min-h-0 gap-1.5">
        <div className="flex w-[14px] shrink-0 flex-col justify-between pb-[15px] pt-[6px] text-right text-[8px] tabular-nums text-[#6d82a3]">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-[15px] top-[6px] flex flex-col justify-between">
            {ticks.map((tick) => (
              <div key={tick} className="h-px w-full bg-[#14243c]" />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-[15px] top-[6px]">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="inv-sight-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#inv-sight-area)" />
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
                key={`${buckets[index].label}-${index}`}
                title={`${buckets[index].label} · ${buckets[index].value} sightings`}
                className={`absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  buckets[index].value === peak.value ? 'bg-white shadow-[0_0_6px_rgba(34,211,238,0.9)]' : 'bg-accent-cyan'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[15px] items-center justify-between">
            {buckets.map((bucket, index) => (
              <span
                key={`${bucket.label}-${index}`}
                className={`tnum text-[7.5px] text-[#8ea1c0] ${bucket.value === peak.value ? 'font-bold text-[#67e8f9]' : ''}`}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="tnum mt-1 text-right text-[7.5px] text-[#55668a]">{bucketLabel} buckets · window derived from the first / last read</div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Camera frequency
 * ------------------------------------------------------------------ */

interface CameraFrequencyPanelProps {
  analytics: InvestigationAnalytics;
  activeCamera: string;
  onSelectCamera: (cameraId: string) => void;
}

/** Bottom analytics 2: how many reads each camera contributed. */
export function CameraFrequencyPanel({ analytics, activeCamera, onSelectCamera }: CameraFrequencyPanelProps) {
  const max = Math.max(...analytics.cameraRows.map((row) => row.reads), 1);

  return (
    <Panel
      title="Camera Frequency"
      tools={
        <span className="tnum flex items-center gap-1 text-3xs text-ink-dim">
          <BarChart3 size={10} />
          {analytics.cameraRows.length} cameras · {analytics.cameraRows.filter((row) => row.primary).length} route nodes
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-[3px] overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {analytics.cameraRows.map((row) => (
        <button
          key={row.cameraId}
          type="button"
          onClick={() => onSelectCamera(row.cameraId)}
          className={`flex items-center gap-2 rounded-[4px] border px-1.5 py-[3px] text-left transition-colors ${
            activeCamera === row.cameraId
              ? 'border-accent-cyan/60 bg-[#083344]/50'
              : 'border-transparent hover:border-edge hover:bg-panel-hover'
          }`}
        >
          <span className="tnum w-[38px] shrink-0 font-mono text-[9.5px] font-bold text-[#9fc7ff]">{row.cameraId}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <CameraIcon size={8} className="shrink-0 text-[#6d82a3]" />
              <span className="truncate text-[8.5px] text-[#94a5c2]">{row.location}</span>
              {row.primary ? (
                <span className="shrink-0 rounded-[2px] bg-accent-cyan/20 px-1 text-[7px] font-bold uppercase text-[#67e8f9]">route</span>
              ) : null}
            </span>
            <span className="mt-[2px] block h-[3.5px] overflow-hidden rounded-full bg-[#14243c]">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${
                  row.primary ? 'bg-gradient-to-r from-accent-blue to-accent-cyan' : 'bg-[#3c5c8f]'
                }`}
                style={{ width: `${(row.reads / max) * 100}%` }}
              />
            </span>
          </span>
          <span className="tnum w-[42px] shrink-0 text-right">
            <span className="block text-[10px] font-bold text-white">{row.reads}</span>
            <span className="block text-[7px] text-[#6d82a3]">reads</span>
          </span>
        </button>
      ))}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Location distribution
 * ------------------------------------------------------------------ */

interface LocationDistributionPanelProps {
  analytics: InvestigationAnalytics;
}

/** Bottom analytics 3: where the target was read, by area and city. */
export function LocationDistributionPanel({ analytics }: LocationDistributionPanelProps) {
  const { locations, cityTotals } = analytics;
  const total = locations.reduce((sum, slice) => sum + slice.count, 0) || 1;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  /* Cumulative dash offsets, computed up-front so nothing mutates in render. */
  const offsets = locations.reduce<number[]>((acc, _slice, index) => {
    const previous = index === 0 ? 0 : acc[index - 1] + (locations[index - 1].count / total) * circumference;
    acc.push(previous);
    return acc;
  }, []);

  return (
    <Panel
      title="Location Distribution"
      tools={
        <span className="tnum flex items-center gap-1 text-3xs text-ink-dim">
          <PieChart size={10} />
          {locations.length} areas · {cityTotals.length} cities
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 gap-2 px-2 pb-2 pt-0.5"
    >
      <div className="relative grid w-[92px] shrink-0 place-items-center">
        <svg viewBox="0 0 80 80" className="h-[92px] w-[92px] -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#14243c" strokeWidth="11" />
          {locations.map((slice, index) => {
            const length = (slice.count / total) * circumference;
            return (
              <circle
                key={slice.id}
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="11"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offsets[index]}
                opacity="0.92"
              />
            );
          })}
        </svg>
        <div className="absolute text-center leading-tight">
          <div className="tnum text-[15px] font-bold text-white">{total}</div>
          <div className="text-[7.5px] uppercase tracking-[0.08em] text-[#6d82a3]">reads</div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 overflow-y-auto">
        {locations.map((slice) => (
          <div key={slice.id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <MapPin size={8} className="shrink-0 text-[#6d82a3]" />
                <span className="truncate text-[9px] font-semibold text-[#dbe6f5]">{slice.label}</span>
                <span className="truncate text-[7.5px] text-[#6d7f9e]">{slice.city}</span>
              </span>
              <span className="mt-[2px] block h-[3px] overflow-hidden rounded-full bg-[#14243c]">
                <span className="block h-full rounded-full" style={{ width: `${slice.share}%`, background: slice.color }} />
              </span>
            </span>
            <span className="tnum w-[40px] shrink-0 text-right">
              <span className="block text-[9.5px] font-bold text-white">{slice.count}</span>
              <span className="block text-[7px] text-[#6d82a3]">{slice.share.toFixed(0)}%</span>
            </span>
          </div>
        ))}

        <div className="mt-1 flex items-center gap-1.5 border-t border-edge-soft pt-1">
          {cityTotals.map((city) => (
            <span
              key={city.city}
              className="tnum flex items-center gap-1 rounded-[3px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[8px] text-[#9fb0cc]"
            >
              {city.city}
              <span className="font-bold text-white">{city.count}</span>
              <span className="text-[#6d82a3]">{city.share.toFixed(0)}%</span>
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}
