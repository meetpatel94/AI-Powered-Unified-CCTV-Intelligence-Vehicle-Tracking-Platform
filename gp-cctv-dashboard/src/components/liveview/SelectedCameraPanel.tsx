import type { ReactNode } from 'react';

import {
  Activity,
  Camera as CameraIcon,
  Cpu,
  ExternalLink,
  Gauge,
  Maximize2,
  Radio,
  Signal,
  Timer,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { drift } from '@/hooks/useTelemetryTick';
import type { LiveCamera } from '@/types/liveView';

interface SelectedCameraPanelProps {
  camera: LiveCamera;
  clock: string;
  tick: number;
}

const statusTone: Record<LiveCamera['status'], { label: string; className: string }> = {
  online: { label: 'ONLINE', className: 'bg-accent-green/15 text-accent-green ring-accent-green/40' },
  critical: { label: 'CRITICAL', className: 'bg-accent-red/15 text-[#ff8b96] ring-accent-red/50' },
  warning: { label: 'DEGRADED', className: 'bg-accent-orange/15 text-accent-orange ring-accent-orange/40' },
  reconnecting: { label: 'RECONNECTING', className: 'bg-accent-orange/15 text-accent-orange ring-accent-orange/40' },
  offline: { label: 'OFFLINE', className: 'bg-accent-red/15 text-[#ff8b96] ring-accent-red/50' },
};

const eventTone = {
  info: 'border-l-accent-blue text-[#9fc7ff]',
  warning: 'border-l-accent-orange text-[#f7b95f]',
  critical: 'border-l-accent-red text-[#ff8b96]',
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
    <div className="flex items-center justify-between gap-1 rounded-[4px] border border-edge-soft bg-[#0c1424] px-1.5 py-[3.5px]">
      <span className="flex items-center gap-1 text-[8.5px] uppercase tracking-wide text-[#7286a6]">
        {icon}
        {label}
      </span>
      <span className={`tnum text-[10px] font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

/** Deep-dive readout for whichever tile the operator has selected. */
export function SelectedCameraPanel({ camera, clock, tick }: SelectedCameraPanelProps) {
  const tone = statusTone[camera.status];
  const isDown = camera.status === 'offline' || camera.status === 'reconnecting';
  const liveFps = camera.fps ? drift(camera.fps, 0.5, `${camera.id}-sel-fps`, tick, 1) : 0;
  const liveLatency = camera.latencyMs ? drift(camera.latencyMs, 14, `${camera.id}-sel-lat`, tick) : 0;
  const liveBitrate = camera.bitrateMbps ? drift(camera.bitrateMbps, 0.3, `${camera.id}-br`, tick, 1) : 0;

  return (
    <Panel
      title="Selected Camera Intelligence"
      tools={
        <span className={`rounded-[3px] px-1.5 py-[2px] text-[8.5px] font-bold tracking-wide ring-1 ${tone.className}`}>
          {tone.label}
        </span>
      }
      className="shrink-0"
      bodyClassName="space-y-1.5 px-2.5 pb-2 pt-1"
    >
      {/* preview */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[4px] border border-edge-soft bg-black">
        {camera.status === 'offline' ? (
          <div className="grid h-full place-items-center text-[9px] font-semibold tracking-wider text-accent-red/90">
            SIGNAL LOST
          </div>
        ) : (
          <>
            <img src={camera.thumbnail} alt={camera.id} className="h-full w-full object-cover opacity-95" />
            {camera.detections
              .filter((d) => d.kind === 'anpr')
              .map((d) => (
                <div
                  key={d.label}
                  className="absolute border-2 border-accent-red"
                  style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%` }}
                >
                  <span className="absolute -top-[12px] left-0 bg-accent-red px-1 text-[7.5px] font-bold text-white">
                    {d.label}
                  </span>
                </div>
              ))}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-1.5 pb-3 pt-1">
              <span className="text-[9px] font-bold text-white">{camera.id}</span>
              <span className="flex items-center gap-1 rounded-[2px] bg-accent-green px-1 py-px text-[7px] font-bold text-black/85">
                <span className="h-1 w-1 rounded-full bg-black/70 animate-pulse-dot" />
                LIVE
              </span>
            </div>
            <div className="tnum absolute bottom-1 right-1.5 text-[8px] text-white/80">{clock}</div>
          </>
        )}
      </div>

      {/* identity */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-bold tracking-wide text-white">{camera.id}</span>
          <span className="truncate text-[10px] text-[#c3cfe2]">
            {camera.location}, {camera.city}
          </span>
        </div>
        <div className="mt-[1px] flex items-center gap-1.5 text-[9px] text-[#7286a6]">
          <span>{camera.zone}</span>
          <span className="h-[8px] w-px bg-edge-strong" />
          <span>{camera.department}</span>
        </div>
      </div>

      {/* telemetry grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <Metric
          icon={<Signal size={9} />}
          label="Stream"
          value={isDown ? 'DOWN' : 'HEALTHY'}
          tone={isDown ? 'text-accent-red' : 'text-accent-green'}
        />
        <Metric icon={<Cpu size={9} />} label="Codec" value={camera.codec} />
        <Metric icon={<Gauge size={9} />} label="FPS" value={liveFps ? liveFps.toFixed(1) : '0.0'} />
        <Metric icon={<Activity size={9} />} label="Resolution" value={camera.resolution} />
        <Metric
          icon={<Timer size={9} />}
          label="Latency"
          value={isDown ? '—' : `${liveLatency} ms`}
          tone={liveLatency > 300 ? 'text-accent-orange' : 'text-[#dbe5f4]'}
        />
        <Metric icon={<Radio size={9} />} label="Bitrate" value={isDown ? '—' : `${liveBitrate} Mb/s`} />
        <Metric
          icon={<Activity size={9} />}
          label="Pkt Loss"
          value={`${camera.packetLoss}%`}
          tone={camera.packetLoss > 1 ? 'text-accent-orange' : 'text-accent-green'}
        />
        <Metric icon={<Timer size={9} />} label="Heartbeat" value={camera.lastHeartbeat} />
      </div>

      {/* RTSP + AI summary */}
      <div className="space-y-1 rounded-[4px] border border-edge-soft bg-[#0c1424] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap text-[8.5px] uppercase tracking-wide text-[#7286a6]">RTSP</span>
          <span className="truncate font-mono text-[8.5px] text-[#9fc7ff]">{camera.streamUrl}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[8.5px] uppercase tracking-wide text-[#7286a6]">Detected Vehicles</span>
          <span className="tnum text-[10px] font-semibold text-[#dbe5f4]">
            {camera.vehicleCount.toLocaleString('en-IN')} today
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[8.5px] uppercase tracking-wide text-[#7286a6]">Latest ANPR</span>
          <span className={`text-[10px] font-bold tracking-wide ${camera.lastPlate ? 'text-white' : 'text-[#7286a6]'}`}>
            {camera.lastPlate ?? 'No reads'}
          </span>
        </div>
      </div>

      {/* recent events */}
      <div>
        <div className="mb-1 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
          Recent Events
        </div>
        <ul className="space-y-1">
          {camera.events.slice(0, 2).map((event) => (
            <li
              key={`${event.time}-${event.text}`}
              className={`border-l-2 bg-[#0c1424] py-[3px] pl-1.5 pr-1 ${eventTone[event.tone]}`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-[9px] leading-[12px] text-[#c3cfe2]">{event.text}</span>
                <span className="tnum shrink-0 text-[8px] text-[#6d82a3]">{event.time}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-[26px] flex-1 items-center justify-center gap-1 rounded-[4px] bg-[#1d6ce0] text-[10px] font-semibold text-white transition-colors hover:bg-[#2a7bf0]"
        >
          <ExternalLink size={11} /> View Details
        </button>
        <button
          type="button"
          className="flex h-[26px] items-center justify-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[10px] text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <CameraIcon size={11} /> Snapshot
        </button>
        <button
          type="button"
          title="Fullscreen"
          className="grid h-[26px] w-[26px] place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    </Panel>
  );
}
