import { useEffect, useRef } from 'react';
import { Crosshair, Locate, Maximize2, Minus, Plus } from 'lucide-react';

import { BaseMap } from '@/components/cameramap/BaseMap';
import { WORLD_H, WORLD_W, places } from '@/data/gisGeometry';
import { useMapViewport } from '@/hooks/useMapViewport';
import type { RouteLeg, VehicleSighting } from '@/types/investigation';

interface JourneyRouteMapProps {
  legs: RouteLeg[];
  nodes: VehicleSighting[];
  activeStep: number | null;
  onSelectStep: (step: number) => void;
  /** Bumped by the page whenever an external control asks for the route to be reframed. */
  frameToken: number;
}

const placeStyle: Record<string, string> = {
  metro: 'text-[10px] font-bold tracking-[0.16em] text-white/80',
  city: 'text-[8.5px] font-semibold tracking-[0.12em] text-[#b9d0ee]/80',
};

/**
 * Mini GIS canvas for the reconstructed journey: the platform basemap, the
 * connected cyan/red route and clickable numbered nodes. Pan, zoom and the
 * `project()` seam are shared with the Camera Map, so real tiles drop in here
 * without touching the investigation UI.
 */
export function JourneyRouteMap({ legs, nodes, activeStep, onSelectStep, frameToken }: JourneyRouteMapProps) {
  const { containerRef, size, view, project, zoomIn, zoomOut, centerOn, fit, handlers, isPanning } = useMapViewport();

  const centroid = nodes.length
    ? {
        x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
        y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
      }
    : { x: 852, y: 470 };

  /* Values the framing effect reads, mirrored after each render so they stay
     out of its dependency list (re-running on `scale` would fight the zoom). */
  const framing = useRef({ centroid, centerOn, scale: view.scale });
  useEffect(() => {
    framing.current = { centroid, centerOn, scale: view.scale };
  });

  /* Keep the reconstruction framed once the canvas has measured itself, and
     whenever an external control bumps `frameToken` (node click, replay). */
  useEffect(() => {
    if (!size.w || !size.h) return;
    const { centroid: point, centerOn: focus, scale } = framing.current;
    focus(point.x, point.y, Math.max(scale, size.w < 420 ? 1.05 : 1.25));
  }, [size.w, size.h, frameToken]);

  const toPath = (points: Array<[number, number]>) =>
    points
      .map(([x, y], i) => {
        const p = project(x, y);
        return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[6px] border border-edge bg-[#061224]">
      <div
        ref={containerRef}
        {...handlers}
        className={`absolute inset-0 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        >
          <BaseMap style="road" />
        </div>

        {/* place labels (metro + city only at this scale) */}
        <div className="pointer-events-none absolute inset-0">
          {places
            .filter((place) => place.kind === 'metro' || place.kind === 'city')
            .map((place) => {
              const p = project(place.x, place.y);
              return (
                <span
                  key={`${place.text}-${place.x}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${placeStyle[place.kind]}`}
                  style={{ left: p.x, top: p.y, textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
                >
                  {place.text}
                </span>
              );
            })}
        </div>

        {/* route */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <marker id="inv-arrow" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#7dd3fc" />
            </marker>
            <marker id="inv-arrow-red" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#fca5a5" />
            </marker>
          </defs>

          {legs.map((leg) => {
            const d = toPath(leg.points);
            const color = leg.critical ? '#ef4444' : '#38bdf8';
            return (
              <g key={`leg-${leg.index}`}>
                <path d={d} fill="none" stroke={color} strokeWidth="8" opacity="0.16" strokeLinecap="round" />
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  markerEnd={leg.critical ? 'url(#inv-arrow-red)' : 'url(#inv-arrow)'}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={leg.critical ? '#fecaca' : '#e0f2fe'}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeDasharray="8 12"
                  opacity="0.85"
                >
                  <animate attributeName="stroke-dashoffset" from="40" to="0" dur="1.6s" repeatCount="indefinite" />
                </path>
              </g>
            );
          })}

          {/* leg telemetry labels */}
          {legs.map((leg) => {
            const mid = leg.points[Math.floor(leg.points.length / 2)];
            const p = project(mid[0], mid[1]);
            return (
              <g key={`lbl-${leg.index}`}>
                <rect
                  x={p.x - 27}
                  y={p.y - 20}
                  width="54"
                  height="13"
                  rx="2.5"
                  fill="#05070f"
                  opacity="0.82"
                  stroke={leg.critical ? '#7f1d1d' : '#1a2942'}
                  strokeWidth="0.7"
                />
                <text
                  x={p.x}
                  y={p.y - 10.5}
                  textAnchor="middle"
                  className="tnum"
                  fontSize="7.5"
                  fill={leg.critical ? '#fca5a5' : '#7dd3fc'}
                >
                  {`${leg.label.split(' min ')[0]}m · ${leg.km}km`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* numbered nodes */}
        {nodes.map((node) => {
          const p = project(node.x, node.y);
          const active = activeStep === node.journeyStep;
          const critical = Boolean(node.watchlistHit);
          return (
            <button
              key={node.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (node.journeyStep) onSelectStep(node.journeyStep);
              }}
              title={`${node.cameraId} · ${node.location} · ${node.time}`}
              className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
              style={{ left: p.x, top: p.y }}
            >
              {critical ? <span className="absolute -inset-1.5 rounded-full bg-accent-red/40 animate-ping2" /> : null}
              <span
                className={`tnum relative grid place-items-center rounded-full border-2 text-[9px] font-bold text-white ${
                  critical ? 'h-[21px] w-[21px] bg-accent-red' : 'h-[18px] w-[18px] bg-[#2563eb]'
                } ${active ? 'border-white scale-110' : 'border-white/80'}`}
                style={{ boxShadow: critical ? '0 0 14px rgba(239,68,68,0.9)' : '0 0 10px rgba(37,99,235,0.85)' }}
              >
                {node.journeyStep}
              </span>
              <span className="tnum absolute left-1/2 top-full mt-[3px] -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-black/75 px-1 text-[7.5px] font-semibold text-[#c9d6ea]">
                {node.cameraId}
              </span>
            </button>
          );
        })}
      </div>

      {/* map chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
        <span className="pointer-events-auto flex items-center gap-1 rounded-[4px] border border-edge bg-[#05070f]/85 px-1.5 py-[3px] text-[8px] font-semibold uppercase tracking-[0.08em] text-[#9fb0cc]">
          <Crosshair size={9} className="text-accent-cyan" />
          Route reconstruction · GIS
        </span>
        <div className="pointer-events-auto flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            className="grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#05070f]/85 text-[#9fb0cc] transition-colors hover:text-white"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            className="grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#05070f]/85 text-[#9fb0cc] transition-colors hover:text-white"
          >
            <Minus size={11} />
          </button>
          <button
            type="button"
            aria-label="Frame the whole route"
            title="Frame route"
            onClick={() => fit()}
            className="grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#05070f]/85 text-[#9fb0cc] transition-colors hover:text-white"
          >
            <Maximize2 size={10} />
          </button>
          <button
            type="button"
            aria-label="Centre on the route"
            title="Centre on route"
            onClick={() => centerOn(centroid.x, centroid.y, 1.5)}
            className="grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#05070f]/85 text-[#9fb0cc] transition-colors hover:text-white"
          >
            <Locate size={10} />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-[#05070f]/95 to-transparent px-1.5 pb-1.5 pt-4">
        <span className="flex items-center gap-2 text-[7.5px] text-[#8ea1c0]">
          <span className="flex items-center gap-1">
            <span className="h-[2px] w-3 rounded-full bg-[#38bdf8]" /> ANPR leg
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[2px] w-3 rounded-full bg-accent-red" /> watchlist leg
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] ring-1 ring-white/70" /> node
          </span>
        </span>
        <span className="tnum text-[7.5px] text-[#55668a]">drag to pan · wheel to zoom · click a node to focus</span>
      </div>
    </div>
  );
}
