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
    <div className="flex items-center justify-between gap-1 rounded-[4px] border border-edge-soft bg-[#0c1424] px-1.5 py-[4px]">
      <span className="flex items-center gap-1 text-[8px] uppercase tracking-wide text-[#7286a6]">
        {icon}
        {label}
      </span>
      <span className={`tnum text-[9.5px] font-semibold ${tone}`}>{value}</span>
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
    <aside className="pointer-events-auto absolute right-3 top-3 z-30 flex max-h-[calc(100%-166px)] w-[262px] flex-col overflow-hidden rounded-md border border-edge bg-[#0a1220]/96 shadow-panel backdrop-blur-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
          Selected Camera Intelligence
        </span>
        <button type="button" onClick={onClose} aria-label="Close panel" className="text-white/40 hover:text-white">
          <X size={12} />
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
            <div className="grid h-full place-items-center text-[9px] text-ink-dim">No cached preview</div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-1.5 pb-3 pt-1">
            <span className="text-[9px] font-bold text-white">{camera.id}</span>
            {isDown ? (
              <span className="rounded-[2px] bg-accent-red px-1 py-px text-[7px] font-bold text-white">
                OFFLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-[2px] bg-accent-green px-1 py-px text-[7px] font-bold text-black/85">
                <span className="h-1 w-1 rounded-full bg-black/70 animate-pulse-dot" /> LIVE
              </span>
            )}
          </div>
          <span className="tnum absolute bottom-1 right-1.5 text-[8px] text-white/80">{clock}</span>
          {camera.alertLabel && (
            <span className="absolute inset-x-0 bottom-0 bg-accent-red/85 py-[2px] text-center text-[7.5px] font-bold tracking-[0.12em] text-white">
              {camera.alertLabel}
            </span>
          )}
        </div>

        {/* identity */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] font-bold tracking-wide text-white">{camera.id}</span>
            <span className="truncate text-[9.5px] text-[#c3cfe2]">{camera.location}</span>
          </div>
          <div className="mt-[1px] flex items-center gap-1.5 text-[8.5px] text-[#7286a6]">
            <span>
              {camera.area}, {camera.city}
            </span>
            <span className="h-[8px] w-px bg-edge-strong" />
            <span>{camera.department}</span>
          </div>
        </div>

        {/* telemetry */}
        <div className="grid grid-cols-2 gap-1">
          <Metric
            icon={<Signal size={8} />}
            label="Stream"
            value={isDown ? 'DOWN' : 'HEALTHY'}
            tone={isDown ? 'text-accent-red' : 'text-accent-green'}
          />
          <Metric icon={<Cpu size={8} />} label="Codec" value={camera.codec} />
          <Metric icon={<Gauge size={8} />} label="FPS" value={fps ? fps.toFixed(1) : '0.0'} />
          <Metric icon={<Activity size={8} />} label="Res" value={camera.resolution} />
          <Metric
            icon={<Timer size={8} />}
            label="Latency"
            value={isDown ? '—' : `${latency} ms`}
            tone={latency > 300 ? 'text-accent-orange' : 'text-[#dbe5f4]'}
          />
          <Metric
            icon={<Radio size={8} />}
            label="Loss"
            value={`${camera.packetLoss}%`}
            tone={camera.packetLoss > 1 ? 'text-accent-orange' : 'text-accent-green'}
          />
        </div>

        <div className="space-y-[3px] rounded-[4px] border border-edge-soft bg-[#0c1424] px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-wide text-[#7286a6]">Vehicles Detected</span>
            <span className="tnum text-[10px] font-semibold text-[#dbe5f4]">
              {camera.vehiclesDetected.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[8px] uppercase tracking-wide text-[#7286a6]">
              <ScanLine size={8} /> Latest ANPR
            </span>
            <span className={`text-[10px] font-bold tracking-wide ${camera.lastPlate ? 'text-white' : 'text-[#7286a6]'}`}>
              {camera.lastPlate ?? 'No reads'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-wide text-[#7286a6]">Heartbeat</span>
            <span className="tnum text-[9.5px] text-[#dbe5f4]">{camera.lastHeartbeat}</span>
          </div>
        </div>

        {/* detections */}
        <div>
          <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
            Recent Detections
          </div>
          <ul className="space-y-[3px]">
            {camera.events.slice(0, 3).map((event) => (
              <li
                key={`${event.time}-${event.text}`}
                className={`border-l-2 bg-[#0c1424] py-[3px] pl-1.5 pr-1 ${eventTone[event.tone]}`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[8.5px] leading-[11px] text-[#c3cfe2]">{event.text}</span>
                  <span className="tnum shrink-0 text-[7.5px] text-[#6d82a3]">{event.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => onViewLiveFeed(camera)}
          className="flex h-[26px] w-full items-center justify-center gap-1.5 rounded-[4px] text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: isDown ? '#334155' : '#1d6ce0' }}
        >
          <MonitorPlay size={11} /> View Live Feed
        </button>
      </div>

      <div className="h-[3px] w-full shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
    </aside>
  );
}
