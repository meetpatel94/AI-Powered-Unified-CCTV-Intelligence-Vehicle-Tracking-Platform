import { useEffect, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  Expand,
  Minimize2,
  Play,
  ScanSearch,
  ShieldAlert,
  X,
} from 'lucide-react';

import type { VehicleSighting } from '@/types/investigation';

interface EvidenceViewerModalProps {
  sighting: VehicleSighting | null;
  plate: string;
  index: number;
  total: number;
  openFullscreen?: boolean;
  onClose: () => void;
  onStep: (direction: -1 | 1) => void;
  onViewCamera: (cameraId: string) => void;
  onExportFrame: (sighting: VehicleSighting) => void;
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[4px] border border-edge bg-[#0c1424] px-2 py-1">
      <div className="truncate text-[7.5px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">{label}</div>
      <div className={`tnum mt-[2px] truncate text-[10px] font-semibold ${tone ?? 'text-[#dbe6f5]'}`}>{value}</div>
    </div>
  );
}

/**
 * Detailed evidence view for a single sighting: full frame, AI overlays,
 * archived filmstrip, detection telemetry and fullscreen toggle.
 */
export function EvidenceViewerModal({
  sighting,
  plate,
  index,
  total,
  openFullscreen = false,
  onClose,
  onStep,
  onViewCamera,
  onExportFrame,
}: EvidenceViewerModalProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  /* The page remounts this modal per sighting, so the filmstrip index starts at 0. */
  const [frame, setFrame] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!openFullscreen || !shellRef.current) return;
    shellRef.current.requestFullscreen?.().catch(() => undefined);
  }, [openFullscreen]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key === 'ArrowRight') onStep(1);
    };
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', listener);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', listener);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [onClose, onStep]);

  if (!sighting) return null;

  const frames = [sighting.thumbnail, ...sighting.frames];
  const active = frames[frame % frames.length];

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      shellRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button type="button" aria-label="Close evidence view" className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-[3px]" onClick={onClose} />

      <div
        ref={shellRef}
        className="relative flex max-h-[94vh] w-[880px] max-w-[96vw] animate-drawer-in flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_60px_rgba(0,0,0,0.8)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-cyan/40 bg-accent-cyan/15">
              <ScanSearch size={13} className="text-accent-cyan" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="tnum truncate font-mono text-[13px] font-bold tracking-[0.06em] text-white">
                  {sighting.cameraId} · Evidence
                </span>
                <span className="rounded-[3px] bg-[#16233a] px-1.5 py-px text-[8px] font-semibold uppercase tracking-[0.06em] text-[#9fb0cc]">
                  {sighting.id}
                </span>
                {sighting.watchlistHit ? (
                  <span className="flex items-center gap-1 rounded-[3px] bg-accent-red/20 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.06em] text-[#ff8b96] ring-1 ring-accent-red/45">
                    <ShieldAlert size={9} /> watchlist match
                  </span>
                ) : null}
                {sighting.journeyStep ? (
                  <span className="tnum rounded-[3px] bg-accent-cyan/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.06em] text-[#67e8f9] ring-1 ring-accent-cyan/40">
                    route node {sighting.journeyStep}
                  </span>
                ) : null}
              </div>
              <div className="tnum truncate text-[9px] text-ink-dim">
                {sighting.location} · {sighting.area} · {sighting.city} · {sighting.time}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-1 text-[9px] text-[#9fb0cc]">
              sighting {index} / {total}
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Toggle fullscreen"
              className="grid h-[28px] w-[28px] place-items-center rounded-[5px] border border-edge bg-[#0c1424] text-[#9fb0cc] transition-colors hover:text-white"
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Expand size={13} />}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-[28px] w-[28px] place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {/* frame */}
          <div className="relative h-[330px] overflow-hidden rounded-md border border-edge bg-[#0c1424]">
            <img src={active} alt={`${sighting.cameraId} evidence frame`} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 animate-sweep bg-gradient-to-b from-accent-cyan/10 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#05070f]/95 to-transparent" />

            {/* detection box */}
            <span className="pointer-events-none absolute left-[16%] top-[24%] h-[54%] w-[58%] border-2 border-accent-cyan/85 shadow-[0_0_20px_-4px_rgba(34,211,238,0.9)]">
              <span className="absolute -left-1 -top-1 h-3 w-3 border-l-2 border-t-2 border-accent-cyan" />
              <span className="absolute -right-1 -top-1 h-3 w-3 border-r-2 border-t-2 border-accent-cyan" />
              <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-accent-cyan" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-accent-cyan" />
              <span className="tnum absolute -top-[17px] left-0 rounded-[2px] bg-[#083344]/95 px-1 py-px text-[8.5px] font-bold text-[#67e8f9]">
                {sighting.vehicleType} {sighting.confidence.toFixed(1)}%
              </span>
            </span>

            {/* ANPR plate box */}
            <span className="pointer-events-none absolute bottom-[26%] left-[30%] h-[9%] w-[22%] border border-accent-red/90">
              <span className="tnum absolute -top-[16px] left-0 rounded-[2px] bg-[#2a0d13]/95 px-1 py-px font-mono text-[9px] font-bold tracking-[0.1em] text-[#ff8b96]">
                {plate}
              </span>
            </span>

            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-[3px] bg-black/75 px-1.5 py-px text-[8.5px] font-bold text-[#9fb0cc] ring-1 ring-edge-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" /> 01 SEP 2026 · {sighting.cameraId}
            </span>
            <span className="tnum absolute right-2 top-2 rounded-[3px] bg-black/75 px-1.5 py-px text-[8.5px] font-semibold text-[#c9d6ea] ring-1 ring-edge-strong">
              {sighting.time} · {sighting.clip}
            </span>
            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
              <span className="tnum flex items-center gap-1 rounded-[3px] bg-black/75 px-1.5 py-px text-[8.5px] text-[#c9d6ea] ring-1 ring-edge-strong">
                <Play size={8} className="text-accent-cyan" /> 00:38 clip · h.265 · {sighting.department}
              </span>
              <span className="tnum rounded-[3px] bg-black/75 px-1.5 py-px text-[8.5px] text-[#8ea1c0] ring-1 ring-edge-strong">
                frame {(frame % frames.length) + 1}/{frames.length} · AI crop 1.0× · {sighting.lat.toFixed(4)}, {sighting.lng.toFixed(4)}
              </span>
            </div>
          </div>

          {/* filmstrip */}
          <div className="mt-1.5 flex items-center gap-1.5">
            {frames.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setFrame(i)}
                title={i === 0 ? 'Primary detection frame' : `Archived frame ${i}`}
                className={`h-[38px] w-[58px] shrink-0 overflow-hidden rounded-[4px] border transition-all ${
                  i === frame % frames.length ? 'border-accent-cyan/80 shadow-glow' : 'border-edge opacity-70 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStep(-1)}
                className="flex h-[26px] items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[9.5px] text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
              >
                <ChevronLeft size={12} /> Prev sighting
              </button>
              <button
                type="button"
                onClick={() => onStep(1)}
                className="flex h-[26px] items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[9.5px] text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
              >
                Next sighting <ChevronRight size={12} />
              </button>
            </span>
          </div>

          {/* telemetry */}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <Field label="Camera" value={`${sighting.cameraId} · ${sighting.department}`} />
            <Field label="Location" value={`${sighting.location}, ${sighting.city}`} />
            <Field label="Zone" value={sighting.zone} />
            <Field label="Timestamp" value={`${sighting.time} · 01 Sep 2026`} />
            <Field label="Plate OCR confidence" value={`${sighting.confidence.toFixed(1)}%`} tone="text-[#6fe0b0]" />
            <Field label="Vehicle" value={`${sighting.make} · ${sighting.vehicleType}`} />
            <Field label="Direction / lane" value={`${sighting.direction} · ${sighting.lane}`} />
            <Field label="Speed" value={`${sighting.speedKph} km/h`} />
            <Field label="Clip reference" value={sighting.clip} />
            <Field label="GIS position" value={`${sighting.lat.toFixed(4)} N, ${sighting.lng.toFixed(4)} E`} />
            <Field label="Frames archived" value={`${frames.length} frames · 90 day retention`} />
            <Field
              label="Chain role"
              value={sighting.journeyStep ? `Primary route node ${sighting.journeyStep}` : sighting.reRead ? 'ANPR re-read' : 'Corridor read'}
              tone="text-[#67e8f9]"
            />
          </div>

          {sighting.note ? (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-[5px] border border-edge-soft bg-[#0d1626] px-2.5 py-2 text-[9.5px] leading-[14px] text-[#94a5c2]">
              <Crosshair size={10} className="mt-px shrink-0 text-accent-cyan" />
              <span>
                <span className="font-bold uppercase tracking-wide text-[#67e8f9]">Analyst note · </span>
                {sighting.note}
              </span>
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-1.5 border-t border-edge px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => onExportFrame(sighting)}
            className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 text-[10px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            <Download size={12} /> Export frame
          </button>
          <button
            type="button"
            onClick={() => onViewCamera(sighting.cameraId)}
            className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 text-[10px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            <CameraIcon size={12} /> View camera
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3 text-[10px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Expand size={12} />}
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </footer>
      </div>
    </div>
  );
}
