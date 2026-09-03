import { useLayoutEffect, useRef, useState } from 'react';

import { Crosshair, X } from 'lucide-react';

import { mapAlertPopup, trackedRoute } from '@/data/cameraMapData';
import type { TrackedVehicleRoute } from '@/types/cameraMap';

interface RouteLayerProps {
  /** Real route from `/api/gis/vehicles/{plate}/route`; defaults to the mock journey. */
  route?: TrackedVehicleRoute;
  project: (x: number, y: number) => { x: number; y: number };
  showAlert: boolean;
  onDismissAlert: () => void;
  onViewDetails: () => void;
  onTrackVehicle: () => void;
  activeStep?: number;
  onSelectStep: (step: number) => void;
  /** Canvas size + deck insets, so the callout stays clear of the floating panels. */
  bounds: { w: number; h: number };
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
}

const ALERT_W = 250;

/** Tracked-vehicle polyline, numbered sighting nodes and the watchlist alert callout. */
export function RouteLayer({
  route = trackedRoute,
  project,
  showAlert,
  onDismissAlert,
  onViewDetails,
  onTrackVehicle,
  activeStep,
  onSelectStep,
  bounds,
  insets,
}: RouteLayerProps) {
  const alertRef = useRef<HTMLDivElement>(null);
  const [alertH, setAlertH] = useState(0);

  useLayoutEffect(() => {
    if (alertRef.current) setAlertH(alertRef.current.offsetHeight);
  }, [showAlert]);
  const toPath = (points: Array<[number, number]>) =>
    points
      .map(([x, y], i) => {
        const p = project(x, y);
        return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(' ');

  const alertNode = route.nodes[route.nodes.length - 1];
  const alertPos = project(alertNode.x, alertNode.y);
  const popup = {
    ...mapAlertPopup,
    vehicle: route.plate,
    camera: alertNode.cameraId,
    location: `${alertNode.road}, ${alertNode.city}`,
    time: alertNode.time,
  };

  const pad = { top: insets?.top ?? 12, right: insets?.right ?? 12, bottom: insets?.bottom ?? 12, left: insets?.left ?? 12 };
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const alertLeft = clamp(alertPos.x - ALERT_W - 18, pad.left, bounds.w - pad.right - ALERT_W);
  const alertTop = clamp(alertPos.y + 16, pad.top, bounds.h - pad.bottom - (alertH || 150));

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker id="cm-arrow" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#7dd3fc" />
          </marker>
        </defs>

        {route.legs.map((leg, i) => {
          const d = toPath(leg.points);
          const color = leg.critical ? '#ef4444' : '#38bdf8';
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={color} strokeWidth="9" opacity="0.18" strokeLinecap="round" />
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="2.6"
                strokeLinecap="round"
                markerEnd="url(#cm-arrow)"
              />
              <path
                d={d}
                fill="none"
                stroke={leg.critical ? '#fecaca' : '#e0f2fe'}
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeDasharray="9 13"
                opacity="0.85"
              >
                <animate attributeName="stroke-dashoffset" from="44" to="0" dur="1.6s" repeatCount="indefinite" />
              </path>
            </g>
          );
        })}
      </svg>

      {/* numbered sighting nodes */}
      {route.nodes.map((node) => {
        const p = project(node.x, node.y);
        const active = activeStep === node.step;
        return (
          <button
            key={node.step}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectStep(node.step);
            }}
            className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
            style={{ left: p.x, top: p.y }}
            title={`${node.cameraId} · ${node.time}`}
          >
            {node.critical && (
              <span className="absolute -inset-1 rounded-full bg-accent-red/40 animate-ping2" />
            )}
            <span
              className={`tnum relative grid place-items-center rounded-full border-2 text-[13px] font-bold text-white ${
                node.critical ? 'h-[26px] w-[26px] bg-accent-red' : 'h-[22px] w-[22px] bg-[#2563eb]'
              } ${active ? 'border-white' : 'border-white/80'}`}
              style={{
                boxShadow: node.critical ? '0 0 16px rgba(239,68,68,0.9)' : '0 0 12px rgba(37,99,235,0.85)',
              }}
            >
              {node.step}
            </span>
          </button>
        );
      })}

      {/* watchlist alert callout */}
      {showAlert && (
        <div
          ref={alertRef}
          className="pointer-events-auto absolute z-40 w-[250px] overflow-hidden rounded-md border border-accent-red/80 bg-[#2b0b10]/96 shadow-glow-red backdrop-blur-sm"
          style={{ left: alertLeft, top: alertTop }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-accent-red/40 bg-accent-red/15 px-2.5 py-2">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-bold tracking-wide text-[#ff8b96]">
              <Crosshair size={13} className="animate-pulse-dot" />
              {popup.title}
            </span>
            <button type="button" onClick={onDismissAlert} aria-label="Dismiss" className="text-[#ff8b96]/70 hover:text-white">
              <X size={13} />
            </button>
          </div>

          <dl className="space-y-1 px-2.5 py-2 text-[13px] text-[#e3c6c9]">
            <div className="flex gap-1">
              <dt className="text-[#c78d95]">Vehicle:</dt>
              <dd className="font-semibold text-white">{popup.vehicle}</dd>
              <dd className="ml-auto rounded-[2px] bg-accent-red/25 px-1.5 py-px text-[12px] font-bold text-[#ffb3ba]">
                {popup.confidence}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#c78d95]">Camera:</dt>
              <dd className="text-white/90">{popup.camera}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#c78d95]">Location:</dt>
              <dd className="text-white/90">{popup.location}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-[#c78d95]">Time:</dt>
              <dd className="tnum text-white/90">{popup.time}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
            <button
              type="button"
              onClick={onViewDetails}
              className="h-[28px] flex-1 whitespace-nowrap rounded-[4px] bg-accent-red text-[13px] font-semibold text-white transition-colors hover:bg-[#dc2626]"
            >
              View Details
            </button>
            <button
              type="button"
              onClick={onTrackVehicle}
              className="h-[28px] flex-1 whitespace-nowrap rounded-[4px] border border-accent-red/60 bg-accent-red/10 text-[13px] font-semibold text-[#ffb3ba] transition-colors hover:bg-accent-red/20"
            >
              Track Vehicle
            </button>
            <button
              type="button"
              onClick={onDismissAlert}
              className="h-[28px] whitespace-nowrap rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[13px] text-[#c3cfe2] transition-colors hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
