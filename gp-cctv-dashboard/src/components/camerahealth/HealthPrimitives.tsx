import { statusMeta } from '@/data/cameraHealthData';
import { toneHex, toneInk } from '@/components/camerahealth/healthTones';

import type { HealthStatus, MetricTone } from '@/types/cameraHealth';

/* ------------------------------------------------------------------ *
 * Status pill
 * ------------------------------------------------------------------ */

interface StatusPillProps {
  status: HealthStatus;
  size?: 'sm' | 'xs';
  /** Pulse the dot — used for live/reconnecting states. */
  pulse?: boolean;
}

export function StatusPill({ status, size = 'sm', pulse }: StatusPillProps) {
  const meta = statusMeta[status];
  const live = pulse ?? (status === 'reconnecting' || status === 'critical');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border font-semibold uppercase tracking-[0.06em] ${meta.chip} ${
        size === 'sm' ? 'px-1.5 py-[2px] text-[9.5px]' : 'px-1 py-[1px] text-3xs'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot} ${live ? 'animate-pulse-dot' : ''}`} />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Live health bar (0-100) — the per-row indicator in the monitor grid
 * ------------------------------------------------------------------ */

interface HealthBarProps {
  score: number;
  tone: MetricTone;
  width?: number;
  showScore?: boolean;
  /** Animate a sweeping highlight to signal a live feed. */
  live?: boolean;
}

export function HealthBar({ score, tone, width = 52, showScore = true, live }: HealthBarProps) {
  const hex = toneHex[tone];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="relative h-[4px] shrink-0 overflow-hidden rounded-full bg-[#111c30] ring-1 ring-inset ring-white/5"
        style={{ width }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: hex, boxShadow: `0 0 6px -1px ${hex}` }}
        />
        {live ? (
          <span
            className="absolute inset-y-0 w-3 animate-sweep opacity-40"
            style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)`, left: `${Math.max(0, score - 12)}%` }}
          />
        ) : null}
      </span>
      {showScore ? (
        <span className="tnum w-[22px] text-right text-[10px] font-semibold" style={{ color: toneInk[tone] }}>
          {score}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Monospace telemetry readout
 * ------------------------------------------------------------------ */

interface TelemetryProps {
  value: string | number;
  unit?: string;
  tone?: MetricTone;
  muted?: boolean;
  title?: string;
}

export function Telemetry({ value, unit, tone, muted, title }: TelemetryProps) {
  return (
    <span className="tnum inline-flex items-baseline gap-[2px] font-mono text-[10.5px]" title={title}>
      <span style={{ color: tone ? toneInk[tone] : muted ? '#7f92b0' : '#d7e1f1' }}>{value}</span>
      {unit ? <span className="text-[9px] text-ink-faint">{unit}</span> : null}
    </span>
  );
}

/** Label / value pair used in the selected-camera inspector. */
export function SpecRow({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: MetricTone;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-edge-soft/60 py-[3px] last:border-b-0">
      <span className="text-[9.5px] uppercase tracking-[0.07em] text-ink-faint">{label}</span>
      <span className="tnum truncate font-mono text-[10.5px]" style={{ color: tone ? toneInk[tone] : '#d7e1f1' }}>
        {children}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Micro sparkline (inline SVG, no chart lib)
 * ------------------------------------------------------------------ */

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  tone?: MetricTone;
  area?: boolean;
}

export function Sparkline({ values, width = 96, height = 22, tone = 'cyan', area = true }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const hex = toneHex[tone];
  const coords = values.map((value, i) => `${(i * step).toFixed(2)},${(height - 2 - ((value - min) / span) * (height - 4)).toFixed(2)}`);
  const line = `M ${coords.join(' L ')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      {area ? <path d={`${line} L ${width},${height} L 0,${height} Z`} fill={hex} opacity={0.14} /> : null}
      <path d={line} fill="none" stroke={hex} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={height - 2 - ((values[values.length - 1] - min) / span) * (height - 4)} r={1.8} fill={hex} />
    </svg>
  );
}
