import { useMemo } from 'react';
import { Activity, Gauge, Radio, Waves } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { seriesToPoints, toArea, toLine } from '@/components/analytics/chartMath';
import { toneInk } from '@/components/camerahealth/healthTones';
import { qualityWindowLabel, streamQualitySummary } from '@/data/cameraHealthData';

import type { MetricTone, QualityPoint, StreamQualitySeries } from '@/types/cameraHealth';

interface StreamQualityPanelProps {
  series: StreamQualitySeries;
  settings: { latencyWarnMs: number; latencyCritMs: number; lossWarnPct: number; lossCritPct: number };
}

interface MiniChartProps {
  label: string;
  icon: typeof Activity;
  points: QualityPoint[];
  color: string;
  tone: MetricTone;
  unit: string;
  digits?: number;
  /** Reference line drawn at this value (threshold) — dashed. */
  threshold?: number;
  thresholdLabel?: string;
  note: string;
}

function MiniChart({ label, icon: Icon, points, color, tone, unit, digits = 1, threshold, thresholdLabel, note }: MiniChartProps) {
  const values = points.map((point) => point.value);
  const last = values[values.length - 1];
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const min = values.reduce((best, value) => (value < best ? value : best), values[0]);
  const headroom = threshold ? Math.max(...values, threshold) * 1.08 : Math.max(...values) * 1.12;
  const scaled = seriesToPoints(values, headroom);
  const line = toLine(scaled);
  const area = toArea(scaled);
  const thresholdY = threshold ? 100 - (threshold / headroom) * 100 : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[5px] border border-edge bg-[#0a1120] px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
          <Icon size={11} style={{ color }} />
          {label}
        </span>
        <span className="tnum flex items-baseline gap-1 font-mono">
          <span className="text-[13px] font-bold leading-none" style={{ color: toneInk[tone] }}>
            {last.toFixed(digits)}
          </span>
          <span className="text-[10.5px] text-ink-faint">{unit}</span>
        </span>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-1 h-[54px] w-full flex-1 overflow-visible">
        <defs>
          <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#152238" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {thresholdY !== null ? (
          <>
            <line
              x1="0"
              y1={thresholdY}
              x2="100"
              y2={thresholdY}
              stroke="#f59e0b"
              strokeWidth="0.9"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity="0.75"
            />
            <text x="1" y={Math.max(4, thresholdY - 2)} fill="#f7b95f" fontSize="4" className="font-mono">
              {thresholdLabel}
            </text>
          </>
        ) : null}
        <polygon points={area} fill={`url(#grad-${label.replace(/\s/g, '')})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <circle cx={scaled[scaled.length - 1].x} cy={scaled[scaled.length - 1].y} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-ink-faint">
        <span>
          avg <span className="text-[#c3cfe2]">{avg.toFixed(digits)}</span>
        </span>
        <span>
          {digits === 2 ? 'min' : 'low'} <span className="text-[#c3cfe2]">{min.toFixed(digits)}</span>
        </span>
        <span>
          peak <span className="text-[#c3cfe2]">{peak.value.toFixed(digits)}</span> @ {peak.label}
        </span>
      </div>
      <p className="mt-[2px] truncate text-[10.5px] text-ink-faint" title={note}>
        {note}
      </p>
    </div>
  );
}

/**
 * STREAM QUALITY — fleet-level fps / latency / bitrate / packet-loss trends
 * over the last two hours, with the operator's warning thresholds overlaid.
 */
export function StreamQualityPanel({ series, settings }: StreamQualityPanelProps) {
  const summary = useMemo(() => streamQualitySummary(series), [series]);

  return (
    <Panel
      title="Stream Quality"
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-2 px-2.5 pb-2.5"
      tools={<span className="tnum font-mono text-[11px] text-ink-faint">{qualityWindowLabel}</span>}
    >
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 xl:grid-cols-4">
        <MiniChart
          label="FPS trend"
          icon={Activity}
          points={series.fps}
          color="#22d3ee"
          tone={summary.fps.avg < 22 ? 'amber' : 'green'}
          unit="fps"
          note={`low ${summary.fps.low.value.toFixed(1)} fps @ ${summary.fps.low.label} · target 25 fps`}
        />
        <MiniChart
          label="Latency trend"
          icon={Gauge}
          points={series.latency}
          color="#2f7dff"
          tone={summary.latency.value >= settings.latencyWarnMs ? 'amber' : 'green'}
          unit="ms"
          digits={0}
          threshold={settings.latencyWarnMs}
          thresholdLabel={`warn ${settings.latencyWarnMs} ms`}
          note={`peak ${summary.latency.peak.value} ms @ ${summary.latency.peak.label} · crit ${settings.latencyCritMs} ms`}
        />
        <MiniChart
          label="Bitrate trend"
          icon={Radio}
          points={series.bitrate}
          color="#a855f7"
          tone="green"
          unit="Mb/s"
          note={`fleet ingest · peak ${summary.bitrate.peak.value} Mb/s @ ${summary.bitrate.peak.label}`}
        />
        <MiniChart
          label="Packet loss"
          icon={Waves}
          points={series.loss}
          color="#f59e0b"
          tone={summary.loss.value >= settings.lossWarnPct ? 'amber' : 'green'}
          unit="%"
          digits={2}
          threshold={settings.lossWarnPct}
          thresholdLabel={`warn ${settings.lossWarnPct}%`}
          note={`peak ${summary.loss.peak.value.toFixed(2)}% @ ${summary.loss.peak.label} · crit ${settings.lossCritPct}%`}
        />
      </div>
    </Panel>
  );
}
