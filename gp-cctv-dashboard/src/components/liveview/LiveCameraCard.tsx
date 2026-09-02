import type { MouseEvent, ReactNode } from 'react';

import {
  Camera as CameraIcon,
  Info,
  Maximize2,
  RefreshCw,
  Volume2,
  VolumeX,
  WifiOff,
  ZoomIn,
} from 'lucide-react';

import { drift } from '@/hooks/useTelemetryTick';
import type { DetectionBox, LiveCamera } from '@/types/liveView';

interface LiveCameraCardProps {
  camera: LiveCamera;
  selected: boolean;
  muted: boolean;
  clock: string;
  tick: number;
  compact?: boolean;
  onSelect: (id: string) => void;
  onToggleMute: (id: string) => void;
}

const statusChip: Record<LiveCamera['status'], { label: string; className: string; dot: string }> = {
  online: { label: 'LIVE', className: 'bg-accent-green text-black/85', dot: 'bg-black/70' },
  critical: { label: 'LIVE', className: 'bg-accent-green text-black/85', dot: 'bg-black/70' },
  warning: { label: 'LIVE', className: 'bg-accent-green text-black/85', dot: 'bg-black/70' },
  reconnecting: { label: 'RECONNECT', className: 'bg-accent-orange text-black/85', dot: 'bg-black/70' },
  offline: { label: 'OFFLINE', className: 'bg-accent-red text-white', dot: 'bg-white/80' },
};

const boxTone: Record<DetectionBox['kind'], string> = {
  vehicle: 'border-accent-cyan/85 text-accent-cyan',
  bike: 'border-accent-cyan/70 text-accent-cyan',
  person: 'border-[#a855f7]/85 text-[#c99bf9]',
  crowd: 'border-accent-orange/90 text-accent-orange',
  anpr: 'border-accent-red text-white',
};

function DetectionOverlay({ boxes }: { boxes: DetectionBox[] }) {
  return (
    <>
      {boxes.map((b, i) => {
        const isAnpr = b.kind === 'anpr';
        return (
          <div
            key={`${b.label}-${i}`}
            className={`absolute border ${boxTone[b.kind]} ${isAnpr ? 'border-2' : ''}`}
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              boxShadow: isAnpr ? '0 0 12px rgba(239,68,68,0.6)' : '0 0 8px rgba(34,211,238,0.25)',
            }}
          >
            <span
              className={`absolute -top-[11px] left-0 whitespace-nowrap px-1 text-[9px] font-bold tracking-wide ${
                isAnpr ? 'bg-accent-red text-white' : 'bg-black/75'
              }`}
            >
              {b.label}
              {isAnpr && b.confidence ? ` · ${(b.confidence * 100).toFixed(1)}%` : ''}
            </span>
            {isAnpr && (
              <>
                <span className="absolute -left-[3px] -top-[3px] h-2 w-2 border-l-2 border-t-2 border-accent-red" />
                <span className="absolute -right-[3px] -top-[3px] h-2 w-2 border-r-2 border-t-2 border-accent-red" />
                <span className="absolute -bottom-[3px] -left-[3px] h-2 w-2 border-b-2 border-l-2 border-accent-red" />
                <span className="absolute -bottom-[3px] -right-[3px] h-2 w-2 border-b-2 border-r-2 border-accent-red" />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/** One tile of the live wall: video frame, AI overlays, telemetry HUD and controls. */
export function LiveCameraCard({
  camera,
  selected,
  muted,
  clock,
  tick,
  compact = false,
  onSelect,
  onToggleMute,
}: LiveCameraCardProps) {
  const chip = statusChip[camera.status];
  const isCritical = camera.status === 'critical';
  const isDown = camera.status === 'offline' || camera.status === 'reconnecting';
  const liveFps = camera.fps ? drift(camera.fps, 0.6, `${camera.id}-fps`, tick, 1) : 0;
  const liveLatency = camera.latencyMs ? drift(camera.latencyMs, 18, `${camera.id}-lat`, tick) : 0;

  return (
    <article
      onClick={() => onSelect(camera.id)}
      className={[
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-md border bg-panel transition-shadow',
        isCritical
          ? 'border-accent-red/80 shadow-[0_0_18px_-5px_rgba(239,68,68,0.85)]'
          : selected
            ? 'border-accent-blue/80 shadow-glow'
            : 'border-edge hover:border-edge-strong',
      ].join(' ')}
    >
      {/* ---------- frame ---------- */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
        {camera.status === 'offline' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#080d16]">
            <div
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, #1b2740 0px, #1b2740 1px, transparent 1px, transparent 3px)',
              }}
            />
            <WifiOff size={18} className="text-accent-red/80" />
            <span className="text-[11px] font-semibold tracking-wider text-accent-red/90">SIGNAL LOST</span>
            <span className="text-[10px] text-ink-dim">Last heartbeat {camera.lastHeartbeat}</span>
          </div>
        ) : (
          <>
            <img
              src={camera.thumbnail}
              alt={`${camera.id} ${camera.location}`}
              className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] ${
                camera.status === 'reconnecting' ? 'opacity-35 blur-[2px] grayscale' : 'opacity-95'
              }`}
              loading="lazy"
            />

            {/* scanline + sweep texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 3px)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="h-8 w-full bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent animate-sweep" />
            </div>

            {camera.aiDetection && <DetectionOverlay boxes={camera.detections} />}

            {camera.status === 'reconnecting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <RefreshCw size={16} className="animate-spin text-accent-orange" />
                <span className="text-[11px] font-semibold tracking-wider text-accent-orange">
                  RECONNECTING…
                </span>
                <span className="text-[10px] text-ink-dim">RTSP retry 3/5</span>
              </div>
            )}
          </>
        )}

        {/* ---------- top HUD ---------- */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-1.5 pb-5 pt-1.5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <span className="shrink-0 whitespace-nowrap text-[12px] font-bold tracking-wide text-white drop-shadow">
                {camera.id}
              </span>
              <span className="truncate text-[10.5px] text-white/80">
                | {camera.location}, {camera.city}
              </span>
            </div>
            {!compact && (
              <div className="mt-[1px] flex items-center gap-1.5 text-[9.5px] text-white/70">
                <span>{camera.zone}</span>
                <span className="h-[7px] w-px bg-white/25" />
                <span>{camera.department}</span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`flex items-center gap-1 rounded-[2px] px-1 py-px text-[9.5px] font-bold uppercase tracking-wide ${chip.className}`}
            >
              <span className={`h-1 w-1 rounded-full ${chip.dot} animate-pulse-dot`} />
              {chip.label}
            </span>
            {camera.anprActive && !isDown && (
              <span className="rounded-[2px] bg-accent-blue/85 px-1 py-px text-[9px] font-bold tracking-wide text-white">
                ANPR
              </span>
            )}
          </div>
        </div>

        {/* ---------- critical banner ---------- */}
        {camera.alertLabel && (
          <div
            className={`absolute inset-x-0 top-[27%] flex items-center justify-center py-[3px] text-[10.5px] font-bold tracking-[0.14em] ${
              isCritical ? 'bg-accent-red/85 text-white' : 'bg-accent-orange/85 text-black/85'
            }`}
          >
            {camera.alertLabel}
          </div>
        )}

        {/* ---------- bottom HUD ---------- */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1.5 pb-1 pt-5">
          <div className="mb-[3px] flex items-center justify-between gap-1 text-[9.5px] text-white/75">
            <span className="tnum flex items-center gap-1.5">
              <span className={isDown ? 'text-accent-red' : 'text-accent-green'}>{camera.quality}</span>
              <span>{liveFps ? `${liveFps.toFixed(1)} fps` : '0 fps'}</span>
              <span>{camera.resolution}</span>
              <span className="rounded-[2px] bg-white/10 px-1">{camera.codec}</span>
            </span>
            <span className="tnum">{clock}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/65">
              <IconButton label="Fullscreen">
                <Maximize2 size={10} strokeWidth={2.2} />
              </IconButton>
              <IconButton label="Snapshot">
                <CameraIcon size={10} strokeWidth={2.2} />
              </IconButton>
              <IconButton
                label={muted ? 'Unmute' : 'Mute'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute(camera.id);
                }}
              >
                {muted ? <VolumeX size={10} strokeWidth={2.2} /> : <Volume2 size={10} strokeWidth={2.2} />}
              </IconButton>
              <IconButton label="Digital zoom">
                <ZoomIn size={10} strokeWidth={2.2} />
              </IconButton>
              <IconButton label="Camera details">
                <Info size={10} strokeWidth={2.2} />
              </IconButton>
            </div>

            <span className="tnum text-[9.5px] text-white/60">
              {isDown ? 'no link' : `${liveLatency} ms`}
            </span>
          </div>
        </div>

        {selected && !isCritical && (
          <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-accent-blue/60" />
        )}
      </div>
    </article>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick ?? ((e) => e.stopPropagation())}
      className="transition-colors hover:text-accent-cyan"
    >
      {children}
    </button>
  );
}
