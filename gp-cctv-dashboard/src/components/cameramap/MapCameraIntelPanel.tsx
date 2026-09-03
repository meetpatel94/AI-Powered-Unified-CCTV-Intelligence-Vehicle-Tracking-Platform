import type { ReactNode } from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  MonitorPlay,
  Radio,
  ScanLine,
  Signal,
  Timer,
  X,
} from 'lucide-react';

import { statusColor } from '@/data/cameraMapData';
import { drift } from '@/hooks/useTelemetryTick';
import type { MapCameraNode } from '@/types/cameraMap';

interface MapCameraIntelPanelProps {
  camera: MapCameraNode;
  tick: number;
  clock: string;
  onClose: () => void;
  onViewLiveFeed: (camera: MapCameraNode) => void;
}

const eventTone = {
  info: 'border-l-accent-blue',
  warning: 'border-l-accent-orange',
  critical: 'border-l-accent-red',
} as const;

function Metric({
  icon,
  label,
  value,
  tone = 'text-[#dbe5f4]',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[4px] border border-edge-soft bg-[#0c1424] px-2 py-[5px]">
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] uppercase tracking-wide text-[#7286a6]">
        {icon}
        {label}
      </span>
      <span className={`tnum shrink-0 text-[12px] font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

/** Right-hand dossier for the selected marker. */
export function MapCameraIntelPanel({
  camera,
  tick,
  clock,
  onClose,
  onViewLiveFeed,
}: MapCameraIntelPanelProps) {
  const color = statusColor[camera.status];
  const isDown = camera.status === 'offline';
  const fps = camera.fps ? drift(camera.fps, 0.5, `${camera.id}-map-fps`, tick, 1) : 0;
  const latency = camera.latencyMs ? drift(camera.latencyMs, 14, `${camera.id}-map-lat`, tick) : 0;

  return (
    <aside className="pointer-events-auto absolute bottom-3 left-3 right-3 top-auto z-30 flex max-h-[55%] w-auto flex-col overflow-hidden rounded-md border border-edge bg-[#0a1220]/96 shadow-panel backdrop-blur-sm md:bottom-auto md:left-auto md:right-3 md:top-3 md:max-h-[calc(100%-24px)] md:w-[360px]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-2.5 py-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
          Selected Camera Intelligence
        </span>
        <button type="button" onClick={onClose} aria-label="Close panel" className="text-white/40 hover:text-white">
          <X size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        {/* preview */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-[4px] border border-edge-soft bg-black">
          {camera.thumbnail ? (
            <img
              src={camera.thumbnail}
              alt={camera.id}
              className={`h-full w-full object-cover ${isDown ? 'opacity-25 grayscale' : 'opacity-95'}`}
            />
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-ink-dim">No cached preview</div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-1.5 pb-3 pt-1">
            <span className="text-[13px] font-bold text-white">{camera.id}</span>
            {isDown ? (
              <span className="rounded-[2px] bg-accent-red px-1.5 py-px text-[11px] font-bold text-white">
                OFFLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-[2px] bg-accent-green px-1.5 py-px text-[11px] font-bold text-black/85">
                <span className="h-1 w-1 rounded-full bg-black/70 animate-pulse-dot" /> LIVE
              </span>
            )}
          </div>
          <span className="tnum absolute bottom-1 right-1.5 text-[12px] text-white/80">{clock}</span>
          {camera.alertLabel && (
            <span className="absolute inset-x-0 bottom-0 bg-accent-red/85 py-[3px] text-center text-[11.5px] font-bold tracking-[0.12em] text-white">
              {camera.alertLabel}
            </span>
          )}
        </div>

        {/* identity */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-bold tracking-wide text-white">{camera.id}</span>
            <span className="truncate text-[13px] text-[#c3cfe2]">{camera.location}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#7286a6]">
            <span>
              {camera.area}, {camera.city}
            </span>
            <span className="h-[8px] w-px bg-edge-strong" />
            <span>{camera.department}</span>
          </div>
        </div>

        {/* telemetry */}
        <div className="grid grid-cols-2 gap-1.5">
          <Metric
            icon={<Signal size={10} />}
            label="Stream"
            value={isDown ? 'DOWN' : 'HEALTHY'}
            tone={isDown ? 'text-accent-red' : 'text-accent-green'}
          />
          <Metric icon={<Cpu size={10} />} label="Codec" value={camera.codec} />
          <Metric icon={<Gauge size={10} />} label="FPS" value={fps ? fps.toFixed(1) : '0.0'} />
          <Metric icon={<Activity size={10} />} label="Res" value={camera.resolution} />
          <Metric
            icon={<Timer size={10} />}
            label="Latency"
            value={isDown ? '—' : `${latency} ms`}
            tone={latency > 300 ? 'text-accent-orange' : 'text-[#dbe5f4]'}
          />
          <Metric
            icon={<Radio size={10} />}
            label="Loss"
            value={`${camera.packetLoss}%`}
            tone={camera.packetLoss > 1 ? 'text-accent-orange' : 'text-accent-green'}
          />
        </div>

        <div className="space-y-1.5 rounded-[4px] border border-edge-soft bg-[#0c1424] px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] uppercase tracking-wide text-[#7286a6]">Vehicles Detected</span>
            <span className="tnum text-[12px] font-semibold text-[#dbe5f4]">
              {camera.vehiclesDetected.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] uppercase tracking-wide text-[#7286a6]">
              <ScanLine size={10} /> Latest ANPR
            </span>
            <span className={`text-[12px] font-bold tracking-wide ${camera.lastPlate ? 'text-white' : 'text-[#7286a6]'}`}>
              {camera.lastPlate ?? 'No reads'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] uppercase tracking-wide text-[#7286a6]">Heartbeat</span>
            <span className="tnum text-[13px] text-[#dbe5f4]">{camera.lastHeartbeat}</span>
          </div>
        </div>

        {/* detections */}
        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
            Recent Detections
          </div>
          <ul className="space-y-1">
            {camera.events.slice(0, 3).map((event) => (
              <li
                key={`${event.time}-${event.text}`}
                className={`border-l-2 bg-[#0c1424] py-1 pl-2 pr-1.5 ${eventTone[event.tone]}`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[13px] leading-[14px] text-[#c3cfe2]">{event.text}</span>
                  <span className="tnum shrink-0 text-[12px] text-[#6d82a3]">{event.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => onViewLiveFeed(camera)}
          className="flex h-[30px] w-full items-center justify-center gap-1.5 rounded-[4px] text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: isDown ? '#334155' : '#1d6ce0' }}
        >
          <MonitorPlay size={13} /> View Live Feed
        </button>
      </div>

      <div className="h-[3px] w-full shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
    </aside>
  );
}
