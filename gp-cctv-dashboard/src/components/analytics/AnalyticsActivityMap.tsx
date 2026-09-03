import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';

import { ChartTip } from '@/components/analytics/ChartTip';
import { formatIn } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import { BaseMap } from '@/components/cameramap/BaseMap';
import { mapCameraNodes, statusColor } from '@/data/cameraMapData';
import { WORLD_H, WORLD_W, places, roads } from '@/data/gisGeometry';
import { useGisCameras } from '@/hooks/useIntelligence';
import { useMapViewport } from '@/hooks/useMapViewport';
import type { AnalyticsSnapshot, CameraActivityRow, UnusualEvent } from '@/types/analytics';
import type { MapCameraNode } from '@/types/cameraMap';

interface AnalyticsActivityMapProps {
  snapshot: AnalyticsSnapshot;
  /** Filter the whole analytics page to a camera (pass 'all' to clear). */
  onSelectCamera: (code: string) => void;
}

interface PlotCamera {
  row: CameraActivityRow;
  node: MapCameraNode;
  watchFlags: UnusualEvent[];
}

const statusLabel: Record<CameraActivityRow['status'], string> = {
  online: 'Online',
  warning: 'Warning',
  critical: 'Critical',
  offline: 'Offline',
};

const placeStyle = {
  metro: 'text-[13px] font-bold tracking-[0.16em] text-white/85',
  city: 'text-[12px] font-semibold tracking-[0.14em] text-[#b9d0ee]/85',
  town: 'text-[10.5px] font-medium tracking-[0.06em] text-[#8ea6c8]/80',
  area: 'text-[10px] tracking-[0.05em] text-[#7f97b8]/75',
  poi: 'text-[9.5px] italic tracking-[0.04em] text-[#6f88ab]/75',
} as const;

const controlBtn =
  'grid h-[28px] w-[28px] place-items-center rounded-[5px] border border-edge bg-[#0b1526]/92 text-[#a6b8d4] transition-colors hover:bg-[#152340] hover:text-white';

/**
 * Fitted region for the analytics map: wide enough to keep every camera
 * marker (incl. the Vadodara corridor at the world's south-east edge) inside
 * the default view — the Camera Map keeps its own tighter metro-belt frame.
 */
const ACTIVITY_FRAME = { cx: 980, cy: 625, spanW: 1100, spanH: 730 };

/**
 * Analytics-focused GIS layer for the Analytics page: the existing SVG world
 * basemap (`data/gisGeometry`) + camera fleet (live `/api/gis/cameras` nodes
 * with the same mock fallback as Camera Map) joined with the current analytics
 * snapshot. One marker per camera encodes — without duplicating the Camera Map
 * page's filter decks, journey replay or popup tooling:
 *   • bubble size — vehicle detections in the selected window
 *   • dot colour  — camera health status
 *   • amber ring  — AI-event hotspot intensity
 *   • red pulse   — watchlist-match location (unusual-activity flags)
 * Clicking a marker filters the whole analytics page to that camera.
 */
export function AnalyticsActivityMap({ snapshot, onSelectCamera }: AnalyticsActivityMapProps) {
  const gis = useGisCameras();
  const { containerRef, project, view, zoomLevel, zoomIn, zoomOut, fit, handlers } = useMapViewport(ACTIVITY_FRAME);

  const [hover, setHover] = useState<{ plot: PlotCamera; x: number; y: number } | null>(null);

  /* Camera fleet: live backend nodes when reachable, else the shared fixtures. */
  const nodes = useMemo(() => gis.nodes ?? mapCameraNodes, [gis.nodes]);

  /* Join the snapshot's camera rows onto GIS coordinates. The live registry
     joins by id (registry ids are the camera codes); the fixture fleet joins by
     location name so non-metro rows (Rajkot / Surat — outside this
     Ahmedabad–Gandhinagar basemap) fall to the out-of-extent list instead of
     being plotted at an unrelated position. */
  const { plotted, extent } = useMemo(() => {
    const findNode = (row: CameraActivityRow): MapCameraNode | null => {
      if (gis.nodes) return nodes.find((node) => node.id === row.code) ?? null;
      return nodes.find((node) => node.location === row.location) ?? null;
    };
    const plottedRows: PlotCamera[] = [];
    const extentRows: CameraActivityRow[] = [];
    for (const row of snapshot.cameras) {
      const node = findNode(row);
      if (!node) {
        extentRows.push(row);
        continue;
      }
      plottedRows.push({
        row,
        node,
        watchFlags: snapshot.unusual.filter((event) => event.camera === row.code && event.tone === 'red'),
      });
    }
    return { plotted: plottedRows, extent: extentRows };
  }, [snapshot.cameras, snapshot.unusual, gis.nodes, nodes]);

  const maxDet = Math.max(1, ...snapshot.cameras.map((row) => row.detections));
  const maxEv = Math.max(1, ...snapshot.cameras.map((row) => row.events));
  const activeCamera = snapshot.filters.camera;

  const onMarkerMove = (plot: PlotCamera) => (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.closest('[data-map-root]')?.getBoundingClientRect();
    setHover({
      plot,
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    });
  };

  const marker = (plot: PlotCamera) => {
    const { row, node, watchFlags } = plot;
    const p = project(node.x, node.y);
    const size = 12 + (row.detections / maxDet) * 20; // 12–32 px bubble
    const evRing = row.events > 0 ? 5 + Math.round((row.events / maxEv) * 9) : 0; // 5–14 px ring gap
    const flagged = watchFlags.length > 0;
    const color = statusColor[row.status];
    const dimmed = activeCamera !== 'all' && activeCamera !== row.code;

    return (
      <div key={row.code} className="absolute left-0 top-0" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
        {/* AI-event hotspot ring */}
        {evRing > 0 ? (
          <span
            className="pointer-events-none absolute rounded-full border-[1.5px]"
            style={{
              width: size + evRing * 2,
              height: size + evRing * 2,
              left: -(size / 2 + evRing),
              top: -(size / 2 + evRing),
              borderColor: 'rgba(245, 158, 11, 0.75)',
              background: 'rgba(245, 158, 11, 0.10)',
              boxShadow: '0 0 10px -2px rgba(245, 158, 11, 0.8)',
              opacity: dimmed ? 0.2 : 1,
            }}
          />
        ) : null}

        {/* Watchlist-match pulse */}
        {flagged ? (
          <>
            <span
              className={`pointer-events-none absolute rounded-full border-2 border-accent-red/90 ${dimmed ? '' : 'animate-ping2'}`}
              style={{
                width: size + 14,
                height: size + 14,
                left: -(size / 2 + 7),
                top: -(size / 2 + 7),
                opacity: dimmed ? 0.2 : undefined,
              }}
            />
            <span
              className="pointer-events-none absolute rounded-full bg-accent-red/25"
              style={{
                width: size + 14,
                height: size + 14,
                left: -(size / 2 + 7),
                top: -(size / 2 + 7),
                opacity: dimmed ? 0.2 : 1,
              }}
            />
          </>
        ) : null}

        {/* Detection bubble — click to filter the page to this camera */}
        <button
          type="button"
          aria-label={`${row.code} · ${row.location}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onSelectCamera(row.code)}
          onMouseMove={onMarkerMove(plot)}
          onMouseLeave={() => setHover(null)}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,box-shadow] ${
            activeCamera === row.code ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-transparent' : ''
          }`}
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color}77 62%, ${color}33)`,
            border: `1.5px solid ${color}`,
            boxShadow: `0 0 ${6 + (row.detections / maxDet) * 10}px -1px ${color}`,
            opacity: dimmed ? 0.25 : 1,
            cursor: 'pointer',
          }}
        />

        {/* Location label */}
        <span
          className={`pointer-events-none absolute left-0 -translate-x-1/2 whitespace-nowrap text-center text-[9.5px] font-semibold text-[#c8d6ec] ${
            dimmed ? 'opacity-25' : ''
          }`}
          style={{
            top: size / 2 + 5,
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9)',
          }}
        >
          {row.location}
        </span>
      </div>
    );
  };

  return (
    <Panel
      title="GIS / Activity Map"
      action={
        <span className="tnum text-3xs text-ink-dim">
          {plotted.length}/{snapshot.cameras.length} cameras plotted · {snapshot.windowNote}
        </span>
      }
      className="shrink-0"
      bodyClassName="p-0"
    >
      <div
        data-map-root
        className="relative h-[420px] w-full min-w-0 overflow-hidden rounded-b-md border-t border-edge bg-[#061224] sm:h-[480px] lg:h-[560px] xl:h-[640px]"
      >
        <div
          ref={containerRef}
          {...handlers}
          className="absolute inset-0 touch-none"
          style={{ cursor: 'grab' }}
        >
          {/* transformed basemap (same world/technology as Camera Map) */}
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left select-none"
            style={{
              width: WORLD_W,
              height: WORLD_H,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            }}
          >
            <BaseMap style="road" />
          </div>

          {/* road + place labels for geographic context */}
          <div className="pointer-events-none absolute inset-0">
            {roads
              .filter((road) => road.label && road.name)
              .map((road) => {
                const p = project(road.label!.x, road.label!.y);
                return (
                  <span
                    key={road.name}
                    className="absolute whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5f7fa8]"
                    style={{
                      left: p.x,
                      top: p.y,
                      transform: `translate(-50%,-50%) rotate(${road.label!.rotate}deg)`,
                      textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                    }}
                  >
                    {road.name}
                  </span>
                );
              })}

            {places
              .filter((place) => (zoomLevel < 1.25 ? place.kind !== 'area' && place.kind !== 'poi' : true))
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

          {/* analytics markers */}
          {plotted.map(marker)}
        </div>

        {/* zoom / reset controls */}
        <div className="absolute right-2.5 top-2.5 z-10 flex flex-col gap-1">
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomIn()} className={controlBtn}>
            <Plus size={14} />
          </button>
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomOut()} className={controlBtn}>
            <Minus size={14} />
          </button>
          <button
            type="button"
            title="Reset view"
            aria-label="Reset view"
            onClick={() => fit()}
            className={controlBtn}
          >
            <Crosshair size={14} />
          </button>
        </div>

        {/* legend */}
        <div className="absolute bottom-2.5 left-2.5 z-10 flex max-w-[calc(100%-20px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] border border-edge bg-[#0a1120]/90 px-2.5 py-1.5 backdrop-blur-sm">
          <span className="flex items-center gap-1 text-[10px] text-[#9fb0cc]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#17a349]" /> online
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent-orange" /> warning
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent-red" /> critical
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#64748b]" /> offline
          </span>
          <span className="hidden items-center gap-1 text-[10px] text-[#9fb0cc] sm:flex">
            <span className="h-2.5 w-2.5 rounded-full border border-accent-cyan/70 bg-accent-cyan/20" />
            bubble = detections
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[#9fb0cc]">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-accent-orange/80" />
            AI-event hotspot
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[#ff8b96]">
            <span className="relative flex h-3 w-3">
              <span className="absolute inset-0 rounded-full border-2 border-accent-red/90" />
            </span>
            watchlist match
          </span>
        </div>

        {/* cameras outside the map extent (non-metro Gujarat rows in the fixture belt) */}
        {extent.length > 0 ? (
          <div className="absolute bottom-2.5 right-2.5 z-10 flex max-w-[240px] flex-col gap-[3px] rounded-[6px] border border-edge bg-[#0a1120]/90 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#6d82a3]">
              outside map extent
            </span>
            {extent.map((row) => (
              <button
                key={row.code}
                type="button"
                title={`Filter to ${row.code}`}
                onClick={() => onSelectCamera(row.code)}
                className="flex items-center gap-1.5 text-left text-[10.5px] text-[#c3cfe2] transition-colors hover:text-white"
              >
                <span className="tnum font-bold text-[#9fc7ff]">{row.code}</span>
                <span className="min-w-0 truncate">
                  {row.location} · {row.city}
                </span>
                <span className="tnum ml-auto shrink-0 font-semibold text-white">{formatIn(row.detections)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* live/fixture data source note */}
        <span className="absolute left-2.5 top-2.5 z-10 rounded-[4px] border border-edge bg-[#0a1120]/85 px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#6d82a3] backdrop-blur-sm">
          {gis.nodes ? 'live gis fleet' : 'gis fixtures'} · {formatIn(snapshot.kpis.vehicles)} detections in window
        </span>

        {hover ? (
          <ChartTip
            visible
            x={hover.x}
            y={hover.y}
            title={`${hover.plot.row.code} · ${statusLabel[hover.plot.row.status]}`}
            rows={[
              { label: hover.plot.row.location, value: hover.plot.row.city, color: statusColor[hover.plot.row.status] },
              { label: 'Detections', value: formatIn(hover.plot.row.detections), color: '#22d3ee' },
              { label: 'AI events', value: formatIn(hover.plot.row.events), color: '#f59e0b' },
              ...(hover.plot.watchFlags.length
                ? [{ label: 'Watchlist flag', value: `${hover.plot.watchFlags.length}`, color: '#ef4444' }]
                : []),
            ]}
          />
        ) : null}
      </div>
    </Panel>
  );
}
