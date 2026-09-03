import {
  Camera as CameraIcon,
  Clock3,
  Compass,
  Gauge,
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
  const valueTone =
    tone === 'cyan' ? 'text-[#67e8f9]' : tone === 'green' ? 'text-[#6fe0b0]' : tone === 'orange' ? 'text-[#f7b95f]' : 'text-white';
  return (
    <div className="min-w-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`tnum mt-[3px] truncate text-[14px] font-bold leading-none ${valueTone}`}>{value}</div>
      <div className="mt-[3px] truncate text-[10px] text-[#7f93b3]">{sub}</div>
    </div>
  );
}

/**
 * ROUTE ANALYSIS: the corridor numbers an investigator quotes — duration,
 * cameras crossed, distance estimate, average inter-camera time, movement
 * direction and the per-leg breakdown.
 */
export function RouteAnalysisPanel({ analysis, legs }: RouteAnalysisPanelProps) {
  return (
    <Panel
      title="Route Analysis"
      tools={
        <span className="tnum flex shrink-0 items-center gap-1 text-3xs text-ink-dim">
          {analysis.stationary ? (
            <span className="flex items-center gap-1 font-semibold text-[#f7b95f]">
              <TriangleAlert size={9} />
              target held at last node
            </span>
          ) : null}
          {legs.length} legs · GIS derived
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="scroll-thin flex min-h-0 flex-col gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
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
          sub={`top ${analysis.topSpeedKph} km/h · avg ${analysis.avgSpeedKph} km/h`}
          icon={<Ruler size={9} className="text-accent-green" />}
          tone="green"
        />
        <Stat
          label="Avg time between cams"
          value={analysis.avgGapLabel}
          sub={`longest ${Math.floor(analysis.longestGap.seconds / 60)}m ${analysis.longestGap.seconds % 60}s`}
          icon={<Timer size={9} className="text-accent-orange" />}
          tone="orange"
        />
      </div>

      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
            <Compass size={9} className="shrink-0 text-accent-cyan" />
            Movement direction
          </span>
          <span className="tnum flex shrink-0 items-center gap-1 text-[11px] text-[#7f93b3]">
            <Gauge size={9} className="text-accent-cyan" />
            {analysis.compass} {String(analysis.bearingDeg).padStart(3, '0')}°
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded-[4px] border border-edge-strong bg-[#0d1626] px-1.5 py-[2px] text-[11.5px] font-semibold text-[#dbe6f5]">
            {analysis.corridorLabel.split(' → ')[0]}
          </span>
          <span className="h-px min-w-4 flex-1 bg-gradient-to-r from-accent-cyan/70 to-accent-red/70" />
          <span className="shrink-0 rounded-[4px] border border-edge-strong bg-[#0d1626] px-1.5 py-[2px] text-[11.5px] font-semibold text-[#dbe6f5]">
            {analysis.corridorLabel.split(' → ')[1]}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        {legs.map((leg) => (
          <div key={`leg-${leg.index}`} className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="tnum shrink-0 rounded-[3px] bg-[#16233a] px-1 text-[10px] font-bold text-[#9fb0cc]">
                L{leg.index}
              </span>
              <span className="tnum shrink-0 font-mono text-[11px] font-semibold text-[#9fc7ff]">{leg.from.cameraId}</span>
              <span className="shrink-0 text-[11px] text-[#55668a]">→</span>
              <span className="tnum shrink-0 font-mono text-[11px] font-semibold text-[#9fc7ff]">{leg.to.cameraId}</span>
              <span className="tnum ml-auto shrink-0 text-[11px] font-bold text-white">{leg.label}</span>
            </div>
            <div className="tnum mt-[3px] flex min-w-0 items-center gap-1.5 text-[10.5px] text-[#94a5c2]">
              <span className="truncate">{leg.from.location} → {leg.to.location}</span>
              <span className="ml-auto shrink-0">
                {leg.km.toFixed(1)} km · {leg.speedKph} km/h
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
