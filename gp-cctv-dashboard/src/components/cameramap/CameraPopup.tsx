import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Activity, Cpu, Gauge, MonitorPlay, Radio, Timer, X } from 'lucide-react';

import { statusColor } from '@/data/cameraMapData';
import type { MapCameraNode } from '@/types/cameraMap';

interface CameraPopupProps {
  camera: MapCameraNode;
  x: number;
  y: number;
  /** Canvas size, so the dossier can flip/clamp instead of running under a deck. */
  bounds: { w: number; h: number };
  /** Space reserved by the floating decks on each edge. */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
  onClose: () => void;
  onViewLiveFeed: (camera: MapCameraNode) => void;
}

function Row({
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
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] uppercase tracking-wide text-[#7286a6]">
        {icon}
        {label}
      </span>
      <span className={`tnum shrink-0 text-[13px] font-medium ${tone}`}>{value}</span>
    </div>
  );
}

/** Marker popup: full camera dossier anchored to the pin. */
const POPUP_W = 264;

export function CameraPopup({ camera, x, y, bounds, insets, onClose, onViewLiveFeed }: CameraPopupProps) {
  const color = statusColor[camera.status];
  const isDown = camera.status === 'offline';

  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (boxRef.current) setHeight(boxRef.current.offsetHeight);
  }, [camera.id]);

  const pad = { top: insets?.top ?? 12, right: insets?.right ?? 12, bottom: insets?.bottom ?? 12, left: insets?.left ?? 12 };
  const minX = pad.left;
  const maxX = Math.max(minX, bounds.w - pad.right - POPUP_W);
  const left = Math.min(Math.max(x - POPUP_W / 2, minX), maxX);

  // prefer below the pin, flip above when the dossier would slip under the journey dock
  const belowTop = y + 14;
  const flipUp = height > 0 && belowTop + height > bounds.h - pad.bottom && y - 14 - height > pad.top;
  const top = flipUp
    ? y - 14 - height
    : Math.min(belowTop, Math.max(pad.top, bounds.h - pad.bottom - height));

  const arrowX = Math.min(Math.max(x - left, 14), POPUP_W - 14);

  return (
    <div
      ref={boxRef}
      className="pointer-events-auto absolute z-40 w-[264px] overflow-hidden rounded-md border bg-[#0a1220]/97 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.95)] backdrop-blur-sm"
      style={{ left, top, borderColor: `${color}88`, visibility: height === 0 ? 'hidden' : 'visible' }}
      onClick={(event) => event.stopPropagation()}
    >
      {/* pointer */}
      <span
        className={`absolute h-[9px] w-[9px] -translate-x-1/2 rotate-45 border-l border-t ${
          flipUp ? '-bottom-[5px] rotate-[225deg]' : '-top-[5px]'
        }`}
        style={{ left: arrowX, background: '#0a1220', borderColor: `${color}88` }}
      />

      <header
        className="flex items-center justify-between gap-2 border-b px-2.5 py-2"
        style={{ borderColor: `${color}44`, background: `${color}18` }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full animate-pulse-dot" style={{ background: color }} />
          <span className="text-[13px] font-bold tracking-wide text-white">{camera.id}</span>
          <span className="truncate text-[13px] text-[#a9bcd8]">{camera.location}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
          <X size={13} />
        </button>
      </header>

      {camera.thumbnail && (
        <div className="relative h-[96px] w-full overflow-hidden bg-black">
          <img
            src={camera.thumbnail}
            alt={camera.id}
            className={`h-full w-full object-cover ${isDown ? 'opacity-25 grayscale' : 'opacity-95'}`}
          />
          {isDown ? (
            <span className="absolute inset-0 grid place-items-center text-[13px] font-bold tracking-wider text-accent-red">
              SIGNAL LOST
            </span>
          ) : (
            <span className="absolute right-1 top-1 flex items-center gap-1 rounded-[2px] bg-accent-green px-1.5 py-px text-[11px] font-bold text-black/85">
              <span className="h-1 w-1 rounded-full bg-black/70 animate-pulse-dot" /> LIVE
            </span>
          )}
          {camera.alertLabel && (
            <span className="absolute inset-x-0 bottom-0 bg-accent-red/85 py-[3px] text-center text-[11.5px] font-bold tracking-[0.12em] text-white">
              {camera.alertLabel}
            </span>
          )}
        </div>
      )}

      <div className="space-y-1 px-2.5 py-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-[#8ea1c0]">
            {camera.area}, {camera.city}
          </span>
          <span
            className="rounded-[2px] px-1.5 py-px text-[11.5px] font-bold uppercase tracking-wide"
            style={{ background: `${color}22`, color }}
          >
            {camera.status}
          </span>
        </div>

        <Row icon={<Radio size={10} />} label="Department" value={camera.department} />
        <Row icon={<Cpu size={10} />} label="Codec" value={camera.codec} />
        <Row icon={<Activity size={10} />} label="Resolution" value={camera.resolution} />
        <Row icon={<Gauge size={10} />} label="FPS" value={isDown ? '—' : `${camera.fps}`} />
        <Row
          icon={<Timer size={10} />}
          label="Latency"
          value={isDown ? '—' : `${camera.latencyMs} ms`}
          tone={camera.latencyMs > 300 ? 'text-accent-orange' : 'text-[#dbe5f4]'}
        />
        <Row icon={<Timer size={10} />} label="Heartbeat" value={camera.lastHeartbeat} />
        <Row
          icon={<Activity size={10} />}
          label="Vehicles"
          value={camera.vehiclesDetected.toLocaleString('en-IN')}
        />
      </div>

      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={() => onViewLiveFeed(camera)}
          className="flex h-[30px] w-full items-center justify-center gap-1.5 rounded-[4px] bg-[#1d6ce0] text-[12px] font-semibold text-white transition-colors hover:bg-[#2a7bf0]"
        >
          <MonitorPlay size={13} /> View Live Feed
        </button>
      </div>
    </div>
  );
}
