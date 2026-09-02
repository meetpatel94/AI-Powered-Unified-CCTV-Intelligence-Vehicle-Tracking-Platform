import {
  ArrowRightLeft,
  Camera as CameraIcon,
  Clock3,
  Compass,
  Gauge,
  Info,
  Ruler,
  Timer,
  TriangleAlert,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { RouteAnalysis, RouteLeg } from '@/types/investigation';

interface RouteAnalysisPanelProps {
  analysis: RouteAnalysis;
  legs: RouteLeg[];
}

function Stat({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: 'default' | 'cyan' | 'green' | 'orange';
}) {
  const valueTone = tone === 'cyan' ? 'text-[#67e8f9]' : tone === 'green' ? 'text-[#6fe0b0]' : tone === 'orange' ? 'text-[#f7b95f]' : 'text-white';
  return (
    <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`tnum mt-[3px] truncate text-[14px] font-bold leading-none ${valueTone}`}>{value}</div>
      <div className="mt-[3px] truncate text-[10px] text-[#7f93b3]">{sub}</div>
    </div>
  );
}

/**
 * ROUTE ANALYSIS: journey duration, cameras crossed, distance estimate,
 * average inter-camera time and movement direction, plus per-leg telemetry.
 */
export function RouteAnalysisPanel({ analysis, legs }: RouteAnalysisPanelProps) {
  const maxKm = Math.max(...legs.map((leg) => leg.km), 0.1);

  return (
    <Panel
      title="Route Analysis"
      tools={<span className="tnum text-3xs text-ink-dim">{legs.length} legs · GIS derived</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
    >
      <div className="grid shrink-0 grid-cols-2 gap-1.5">
        <Stat
          label="Journey duration"
          value={analysis.durationLabel}
          sub={`${Math.floor(analysis.durationSec / 60)} min ${analysis.durationSec % 60} s elapsed`}
          icon={<Clock3 size={9} className="text-accent-cyan" />}
          tone="cyan"
        />
        <Stat
          label="Cameras crossed"
          value={String(analysis.camerasCrossed)}
          sub={`${analysis.primaryNodes} route nodes · ${legs.length} legs`}
          icon={<CameraIcon size={9} className="text-accent-blue" />}
        />
        <Stat
          label="Distance estimate"
          value={`${analysis.distanceKm.toFixed(1)} km`}
          sub={`top speed ${analysis.topSpeedKph} km/h · avg ${analysis.avgSpeedKph} km/h`}
          icon={<Ruler size={9} className="text-accent-green" />}
          tone="green"
        />
        <Stat
          label="Avg time between cams"
          value={analysis.avgGapLabel}
          sub={`longest ${Math.floor(analysis.longestGap.seconds / 60)}m ${analysis.longestGap.seconds % 60}s · ${analysis.longestGap.label}`}
          icon={<Timer size={9} className="text-accent-orange" />}
          tone="orange"
        />
      </div>

      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
            <Compass size={9} className="text-accent-cyan" />
            Movement direction
          </span>
          <span className="tnum text-[11px] text-[#7f93b3]">
            bearing {String(analysis.bearingDeg).padStart(3, '0')}° · {analysis.zones} zones
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-[4px] border border-edge-strong bg-[#0d1626] px-1.5 py-[2px] text-[11.5px] font-semibold text-[#dbe6f5]">
            {analysis.corridorLabel.split(' → ')[0]}
          </span>
          <span className="flex flex-1 items-center gap-1">
            <span className="h-px flex-1 bg-gradient-to-r from-accent-cyan/70 to-accent-red/70" />
            <ArrowRightLeft size={11} className="shrink-0 text-accent-cyan" />
            <span className="h-px flex-1 bg-gradient-to-r from-accent-red/70 to-accent-cyan/70" />
          </span>
          <span className="rounded-[4px] border border-edge-strong bg-[#0d1626] px-1.5 py-[2px] text-[11.5px] font-semibold text-[#dbe6f5]">
            {analysis.corridorLabel.split(' → ')[1]}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-[#7f93b3]">
          <span className="tnum">
            heading {analysis.compass} · {analysis.departments.join(' / ')}
          </span>
          <span className="tnum flex items-center gap-1">
            <Gauge size={9} className="text-accent-cyan" />
            {analysis.avgSpeedKph} km/h avg
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        {legs.map((leg) => (
          <div key={`leg-${leg.index}`} className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span className="tnum rounded-[3px] bg-[#16233a] px-1 text-[10px] font-bold text-[#9fb0cc]">L{leg.index}</span>
              <span className="tnum font-mono text-[11px] font-semibold text-[#9fc7ff]">{leg.from.cameraId}</span>
              <span className="text-[11px] text-[#55668a]">→</span>
              <span className="tnum font-mono text-[11px] font-semibold text-[#9fc7ff]">{leg.to.cameraId}</span>
              <span className="tnum ml-auto text-[11px] font-bold text-white">{leg.label}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-[3.5px] flex-1 overflow-hidden rounded-full bg-[#14243c]">
                <span
                  className={`block h-full rounded-full transition-all duration-500 ${leg.critical ? 'bg-accent-red' : 'bg-gradient-to-r from-accent-blue to-accent-cyan'}`}
                  style={{ width: `${(leg.km / maxKm) * 100}%` }}
                />
              </span>
              <span className="tnum shrink-0 text-[10.5px] text-[#94a5c2]">
                {leg.km.toFixed(1)} km · {leg.speedKph} km/h
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="flex shrink-0 items-start gap-1 rounded-[4px] border border-edge-soft bg-[#0d1626] px-1.5 py-1 text-[10px] leading-[11.5px] text-[#7f93b3]">
        <Info size={9} className="mt-px shrink-0 text-accent-cyan" />
        Distance is estimated from the GIS route geometry and inter-camera travel time, not from a surveyed path. Longest
        dwell ({Math.floor(analysis.longestGap.seconds / 60)}m {analysis.longestGap.seconds % 60}s at {analysis.longestGap.label})
        is inside the corridor tolerance.
        {analysis.stationary ? (
          <span className="ml-1 flex items-center gap-1 font-semibold text-[#f7b95f]">
            <TriangleAlert size={9} /> target held at last node
          </span>
        ) : null}
      </p>
    </Panel>
  );
}
