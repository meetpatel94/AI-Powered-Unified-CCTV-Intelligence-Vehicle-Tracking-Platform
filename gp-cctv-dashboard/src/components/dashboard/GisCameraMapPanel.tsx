import type { ReactNode } from 'react';

import { Camera, Crosshair, Layers, Minus, Navigation, Plus, Settings2, SlidersHorizontal, TriangleAlert } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import {
  MAP_H,
  MAP_W,
  arterials,
  greenAreas,
  highways,
  mapLabels,
  minorStreets,
  riverPath,
  secondaries,
  urbanBlocks,
} from '@/data/mapData';
import type { MapCamera } from '@/types';

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

const labelStyles = {
  city: 'text-[15px] font-semibold tracking-[0.06em] text-white/85',
  town: 'text-[10.5px] font-medium tracking-[0.04em] text-[#8ea6c8]/85',
  area: 'text-[11.5px] font-semibold tracking-[0.08em] text-[#a9c1e4]/85',
  road: 'text-[9px] font-medium uppercase tracking-[0.12em] text-[#5f7fa8]',
} as const;

function MapControlButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-[26px] w-[26px] place-items-center border-edge bg-[#0b1526]/90 text-[#a6b8d4] backdrop-blur-sm transition-colors hover:bg-[#152340] hover:text-white"
    >
      {children}
    </button>
  );
}

/** Dark GIS basemap with backend camera fleet only; no fabricated route/alert overlays. */
export function GisCameraMapPanel({ cameras = [] }: { cameras?: MapCamera[] }) {
  return (
    <Panel
      title="GIS Camera Map"
      tools={
        <div className="flex items-center gap-1.5 text-[#8ea3c4]">
          <button type="button" aria-label="Recenter" className="transition-colors hover:text-white">
            <Navigation size={12.5} strokeWidth={1.9} />
          </button>
          <button type="button" aria-label="Layers" className="transition-colors hover:text-white">
            <Layers size={12.5} strokeWidth={1.9} />
          </button>
          <button type="button" aria-label="Filters" className="transition-colors hover:text-white">
            <SlidersHorizontal size={12.5} strokeWidth={1.9} />
          </button>
        </div>
      }
      className="h-full"
      bodyClassName="relative overflow-hidden rounded-b-md p-0"
    >
      <div className="absolute inset-0 m-2 mt-0.5 overflow-hidden rounded-[4px] bg-[#061224]">
        {/* ---------------- basemap ---------------- */}
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <radialGradient id="map-glow" cx="42%" cy="62%" r="55%">
              <stop offset="0%" stopColor="#0f2a4d" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#061224" stopOpacity="0" />
            </radialGradient>
            <pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#0d2038" strokeWidth="0.6" />
            </pattern>
          </defs>

          <rect width={MAP_W} height={MAP_H} fill="#061224" />
          <rect width={MAP_W} height={MAP_H} fill="url(#map-grid)" opacity="0.55" />
          <rect width={MAP_W} height={MAP_H} fill="url(#map-glow)" />

          {/* green belts */}
          {greenAreas.map((d, i) => (
            <path key={`g-${i}`} d={d} fill="#0e2b23" opacity="0.7" />
          ))}

          {/* Sabarmati river */}
          <path d={riverPath} fill="none" stroke="#123a5e" strokeWidth="9" strokeLinecap="round" opacity="0.85" />
          <path d={riverPath} fill="none" stroke="#1b5580" strokeWidth="3" strokeLinecap="round" opacity="0.55" />

          {/* built-up blocks */}
          {urbanBlocks.map((b, i) => (
            <rect
              key={`b-${i}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="1.5"
              fill="#9dc0ee"
              opacity={b.o}
            />
          ))}

          {/* minor streets */}
          {minorStreets.map((d, i) => (
            <path key={`m-${i}`} d={d} fill="none" stroke="#16324f" strokeWidth="1.1" strokeLinecap="round" />
          ))}

          {/* secondary roads */}
          {secondaries.map((d, i) => (
            <path key={`s-${i}`} d={d} fill="none" stroke="#1e4062" strokeWidth="1.9" strokeLinecap="round" />
          ))}

          {/* arterials */}
          {arterials.map((d, i) => (
            <g key={`a-${i}`}>
              <path d={d} fill="none" stroke="#24507c" strokeWidth="3.6" strokeLinecap="round" />
              <path d={d} fill="none" stroke="#3a6fa6" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
            </g>
          ))}

          {/* highways */}
          {highways.map((d, i) => (
            <g key={`h-${i}`}>
              <path d={d} fill="none" stroke="#6b5320" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
              <path d={d} fill="none" stroke="#c9973a" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
            </g>
          ))}
        </svg>

        {/* ---------------- place labels ---------------- */}
        {mapLabels.map((label) => (
          <span
            key={`${label.text}-${label.x}-${label.y}`}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${labelStyles[label.size]}`}
            style={{
              left: pct(label.x, MAP_W),
              top: pct(label.y, MAP_H),
              transform: `translate(-50%,-50%) rotate(${label.rotate ?? 0}deg)`,
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            }}
          >
            {label.text}
          </span>
        ))}

        {/* ---------------- camera markers ---------------- */}
        {cameras.map((cam) => {
          const warning = cam.state === 'warning';
          return (
            <div
              key={cam.id}
              title={`Camera ${cam.id}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pct(cam.x, MAP_W), top: pct(cam.y, MAP_H) }}
            >
              <span
                className={`grid h-[19px] w-[19px] place-items-center rounded-full ring-2 ring-black/40 ${
                  warning ? 'bg-accent-orange' : 'bg-[#17a349]'
                }`}
                style={{
                  boxShadow: warning ? '0 0 10px rgba(245,158,11,0.8)' : '0 0 9px rgba(23,163,73,0.65)',
                }}
              >
                {warning ? (
                  <TriangleAlert size={10} strokeWidth={2.4} className="text-black/85" />
                ) : (
                  <Camera size={10} strokeWidth={2.3} className="text-white" />
                )}
              </span>
              <span
                className={`absolute left-1/2 top-full -mt-[3px] h-2 w-2 -translate-x-1/2 rotate-45 ${
                  warning ? 'bg-accent-orange' : 'bg-[#17a349]'
                }`}
              />
            </div>
          );
        })}

        {cameras.length === 0 && (
          <div className="absolute left-1/2 top-1/2 w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-[6px] border border-edge bg-[#0b1526]/90 px-4 py-3 text-center shadow-panel">
            <div className="text-[13px] font-semibold text-white">No geocoded cameras</div>
            <div className="mt-1 text-[11px] text-ink-dim">Backend camera registry returned an empty map.</div>
          </div>
        )}

        {/* ---------------- map controls ---------------- */}
        <div className="absolute bottom-3 right-2.5 flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-[4px] border border-edge divide-y divide-edge">
            <MapControlButton label="Zoom in">
              <Plus size={13} strokeWidth={2.4} />
            </MapControlButton>
            <MapControlButton label="Zoom out">
              <Minus size={13} strokeWidth={2.4} />
            </MapControlButton>
          </div>
          <div className="flex flex-col overflow-hidden rounded-[4px] border border-edge divide-y divide-edge">
            <MapControlButton label="Locate">
              <Crosshair size={12} strokeWidth={2.1} />
            </MapControlButton>
            <MapControlButton label="Map settings">
              <Settings2 size={12} strokeWidth={2.1} />
            </MapControlButton>
          </div>
        </div>

        {/* legend */}
        <div className="absolute bottom-3 left-2.5 flex items-center gap-3 rounded-[4px] border border-edge bg-[#0b1526]/85 px-2 py-1 text-3xs text-[#93a7c6] backdrop-blur-sm">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#17a349]" /> Online
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-orange" /> Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-red" /> Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[2px] w-3 rounded-full bg-[#3b82f6]" /> Tracked route
          </span>
        </div>
      </div>
    </Panel>
  );
}
