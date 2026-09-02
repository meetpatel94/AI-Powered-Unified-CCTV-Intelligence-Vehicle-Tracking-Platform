import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Timer,
} from 'lucide-react';

import { NUMERIC_META_OF, SECTION_META } from '@/data/settingsData';
import { drift } from '@/hooks/useTelemetryTick';

import {
  InfoNote,
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSelect,
  SettingSlider,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { PerformanceConfig, SettingValue } from '@/types/settings';

interface PerformanceSectionProps {
  cfg: PerformanceConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'performance';

const telemetryMeta: Array<{
  id: string;
  label: string;
  sub: string;
  base: number;
  spread: number;
  color: string;
  glow: string;
  warnAt?: number;
  critAt?: number;
}> = [
  { id: 'cpu', label: 'CPU', sub: '8× vCPU · inference cluster', base: 46, spread: 14, color: '#22d3ee', glow: 'rgba(34,211,238,0.5)', warnAt: 75, critAt: 90 },
  { id: 'gpu', label: 'GPU', sub: '4× A100 80 GB · 41% VRAM', base: 38, spread: 18, color: '#a855f7', glow: 'rgba(168,85,247,0.5)', warnAt: 85, critAt: 95 },
  { id: 'ram', label: 'RAM', sub: '256 GB ECC · 142 GB used', base: 55, spread: 8, color: '#2f7dff', glow: 'rgba(47,125,255,0.5)', warnAt: 85, critAt: 95 },
  { id: 'storage', label: 'Storage I/O', sub: 'Ceph cluster · 6.2 GB/s', base: 34, spread: 12, color: '#22c55e', glow: 'rgba(34,197,94,0.5)', warnAt: 90, critAt: 97 },
  { id: 'network', label: 'Network', sub: 'Backbone · 6.8 Gbps of 10 Gbps', base: 62, spread: 9, color: '#f59e0b', glow: 'rgba(245,158,11,0.5)', warnAt: 85, critAt: 95 },
];

/** Compute / GPU / stream telemetry with threshold controls. Values drift
 *  like a real telemetry feed (mock of `/api/v1/system/telemetry`). */
export function PerformanceSection({ cfg, patch, pending }: PerformanceSectionProps) {
  const meta = SECTION_META.performance;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), Math.max(500, cfg.telemetryIntervalSec * 1000));
    return () => window.clearInterval(timer);
  }, [cfg.telemetryIntervalSec]);

  const valueOf = useCallback(
    (id: string, base: number, spread: number) => drift(base, spread, `perf-${id}`, tick, 1),
    [tick],
  );

  const cpu = valueOf('cpu', telemetryMeta[0].base, telemetryMeta[0].spread);
  const gpu = valueOf('gpu', telemetryMeta[1].base, telemetryMeta[1].spread);
  const ram = valueOf('ram', telemetryMeta[2].base, telemetryMeta[2].spread);
  const storageIo = valueOf('storage', telemetryMeta[3].base, telemetryMeta[3].spread);
  const net = valueOf('network', telemetryMeta[4].base, telemetryMeta[4].spread);
  const latency = Math.round(drift(31, 9, 'perf-lat', tick, 0));
  const sessions = Math.round(drift(1210, 18, 'perf-sessions', tick, 0));

  return (
    <SectionPanel
      id="section-performance"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="green" pulse>telemetry live · {cfg.telemetryIntervalSec}s</StateChip>}
    >
      {/* Live utilisation bars */}
      <div className="grid grid-cols-1 gap-2 border-b border-edge/40 py-3 sm:grid-cols-2 2xl:grid-cols-3">
        <MeterBar id="cpu" label="CPU" sub={telemetryMeta[0].sub} value={cpu} meta={telemetryMeta[0]} warnAt={cfg.cpuWarnPct} critAt={cfg.cpuCritPct} />
        <MeterBar id="gpu" label="GPU" sub={telemetryMeta[1].sub} value={gpu} meta={telemetryMeta[1]} warnAt={85} critAt={95} />
        <MeterBar id="ram" label="RAM" sub={telemetryMeta[2].sub} value={ram} meta={telemetryMeta[2]} warnAt={cfg.ramWarnPct} critAt={96} />
        <MeterBar id="stio" label="Storage I/O" sub={telemetryMeta[3].sub} value={storageIo} meta={telemetryMeta[3]} warnAt={90} critAt={97} />
        <MeterBar id="net" label="Network" sub={telemetryMeta[4].sub} value={net} meta={telemetryMeta[4]} warnAt={85} critAt={95} />
        <StreamLoadCard latency={latency} sessions={sessions} capacityWarn={cfg.streamCapacityWarnPct} />
      </div>

      <SectionSubhead right="thresholds drive alerts">
        <span className="flex items-center gap-1.5">
          <Gauge size={11} />
          Alert thresholds
        </span>
      </SectionSubhead>

      <SettingRow label="CPU warning threshold" hint="Crossing this sustained load raises a performance WARNING.">
        <SettingSlider ariaLabel="CPU warning threshold" value={cfg.cpuWarnPct} meta={NUMERIC_META_OF(`${p}.cpuWarnPct`)} onChange={(next) => patch(`${p}.cpuWarnPct`, next)} />
      </SettingRow>

      <SettingRow label="CPU critical threshold" hint="Sustained load above this triggers CRITICAL and node rebalancing.">
        <SettingSlider ariaLabel="CPU critical threshold" value={cfg.cpuCritPct} meta={NUMERIC_META_OF(`${p}.cpuCritPct`)} onChange={(next) => patch(`${p}.cpuCritPct`, next)} />
      </SettingRow>

      <SettingRow label="Memory warning threshold" hint="RAM fill that flags the console for review.">
        <SettingSlider ariaLabel="Memory warning threshold" value={cfg.ramWarnPct} meta={NUMERIC_META_OF(`${p}.ramWarnPct`)} onChange={(next) => patch(`${p}.ramWarnPct`, next)} />
      </SettingRow>

      <SettingRow label="Inference latency warning" hint="p50 model latency above this logs an AI-engine performance event.">
        <SettingSlider ariaLabel="Inference latency warning" value={cfg.inferenceLatencyWarnMs} meta={NUMERIC_META_OF(`${p}.inferenceLatencyWarnMs`)} onChange={(next) => patch(`${p}.inferenceLatencyWarnMs`, next)} />
      </SettingRow>

      <SettingRow label="Stream capacity warning" hint="Session fill ratio that warns the gateway is nearing its ceiling.">
        <SettingSlider ariaLabel="Stream capacity warning" value={cfg.streamCapacityWarnPct} meta={NUMERIC_META_OF(`${p}.streamCapacityWarnPct`)} onChange={(next) => patch(`${p}.streamCapacityWarnPct`, next)} />
      </SettingRow>

      <SettingRow label="Telemetry interval" hint="Refresh cadence for every live meter on this page.">
        <SettingSelect
          ariaLabel="Telemetry interval"
          value={cfg.telemetryIntervalSec}
          onChange={(next) => patch(`${p}.telemetryIntervalSec`, Number(next))}
          options={[
            { value: 1, label: 'Every 1 second' },
            { value: 2, label: 'Every 2 seconds' },
            { value: 5, label: 'Every 5 seconds' },
            { value: 10, label: 'Every 10 seconds' },
          ]}
        />
      </SettingRow>

      <div className="pt-1">
        <InfoNote tone="slate" icon={Activity}>
          Mock telemetry with ±jitter · seam ready for <span className="font-mono text-[10.5px] text-accent-cyan">/api/v1/system/telemetry</span> and{' '}
          <span className="font-mono text-[10.5px] text-accent-cyan">ws://…/telemetry</span>.
        </InfoNote>
      </div>
    </SectionPanel>
  );
}

function MeterBar({
  id,
  label,
  sub,
  value,
  meta,
  warnAt,
  critAt,
}: {
  id: string;
  label: string;
  sub: string;
  value: number;
  meta: { color: string; glow: string };
  warnAt: number;
  critAt: number;
}) {
  const color = value >= critAt ? '#ef4444' : value >= warnAt ? '#f59e0b' : meta.color;
  return (
    <div className="rounded-[6px] border border-edge bg-[#0c1424] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#c7d4e8]">
          {labelIcon(id)}
          {label}
        </span>
        <span className="tnum text-[15px] font-bold leading-none" style={{ color }}>
          {value.toFixed(1)}
          <span className="text-[10px] font-medium text-ink-faint"> %</span>
        </span>
      </div>
      <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-[#16243c]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(value, 100)}%`, background: color, boxShadow: `0 0 9px -1px ${meta.glow}` }}
        />
      </div>
      <div className="mt-1 text-[9.5px] leading-[11px] text-ink-faint">{sub}</div>
    </div>
  );
}

function labelIcon(id: string) {
  const cls = 'h-3 w-3 text-ink-faint';
  switch (id) {
    case 'cpu':
      return <Cpu size={12} className={cls} />;
    case 'gpu':
      return <Cpu size={12} className={cls} />;
    case 'ram':
      return <MemoryStick size={12} className={cls} />;
    case 'stio':
      return <HardDrive size={12} className={cls} />;
    case 'net':
      return <Network size={12} className={cls} />;
    default:
      return <Activity size={12} className={cls} />;
  }
}

function StreamLoadCard({
  latency,
  sessions,
  capacityWarn,
}: {
  latency: number;
  sessions: number;
  capacityWarn: number;
}) {
  const cap = 1536;
  const fill = Math.min((sessions / cap) * 100, 100);
  const warnColor = fill >= capacityWarn ? '#f59e0b' : '#22d3ee';
  return (
    <div className="rounded-[6px] border border-edge bg-[#0c1424] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#c7d4e8]">
          <Timer size={12} className="text-ink-faint" />
          Inference
        </span>
        <span className="tnum text-[15px] font-bold leading-none text-[#a5f3fc]">
          {latency}
          <span className="text-[10px] font-medium text-ink-faint"> ms</span>
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-ink-faint">Stream capacity</span>
        <span className="tnum text-[10.5px] font-semibold" style={{ color: warnColor }}>
          {sessions} / {cap}
        </span>
      </div>
      <div className="mt-1 h-[6px] w-full overflow-hidden rounded-full bg-[#16243c]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fill}%`, background: warnColor, boxShadow: `0 0 9px -1px ${warnColor}` }} />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9.5px] text-ink-faint">WebSocket · 128 clients</span>
        <span className="flex items-center gap-1 text-[9.5px] font-semibold text-[#6fe0b0]">
          <span className="h-1 w-1 rounded-full bg-accent-green animate-pulse-dot" /> Connected
        </span>
      </div>
    </div>
  );
}
