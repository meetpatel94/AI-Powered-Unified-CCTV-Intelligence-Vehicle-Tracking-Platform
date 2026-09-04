import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Layers, MapPinned, Maximize, RefreshCw, TrendingUp } from 'lucide-react';

import { AiEventsByTypePanel } from '@/components/analytics/AiEventsByTypePanel';
import { VehicleDetectionTrend } from '@/components/analytics/VehicleDetectionTrend';
import { WatchlistMatchTrendPanel } from '@/components/analytics/WatchlistMatchTrendPanel';
import { BaseMap, type BaseMapStyle } from '@/components/cameramap/BaseMap';
import { CameraMarkerLayer, buildClusters, type Cluster } from '@/components/cameramap/CameraMarkerLayer';
import { CameraPopup } from '@/components/cameramap/CameraPopup';
import { JourneyPanel } from '@/components/cameramap/JourneyPanel';
import { MapCameraIntelPanel } from '@/components/cameramap/MapCameraIntelPanel';
import { MapControls } from '@/components/cameramap/MapControls';
import { MapFilterPanel } from '@/components/cameramap/MapFilterPanel';
import { MapLegend, MapStatsStrip } from '@/components/cameramap/MapStatsStrip';
import { RouteLayer } from '@/components/cameramap/RouteLayer';
import { mapCameraNodes, statusColor, trackedRoute } from '@/data/cameraMapData';
import { computeAnalytics, defaultAnalyticsFilters } from '@/data/analyticsData';
import { WORLD_H, WORLD_W, places, roads } from '@/data/gisGeometry';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useDashboardKpis, useGisCameras, useGisRoute } from '@/hooks/useIntelligence';
import { useMapViewport } from '@/hooks/useMapViewport';
import { useTelemetryTick } from '@/hooks/useTelemetryTick';
import type { CameraMapFilters, MapCameraNode, MapLayerState } from '@/types/cameraMap';

const placeStyle = {
  metro: 'text-[13px] font-bold tracking-[0.16em] text-white/85',
  city: 'text-[12px] font-semibold tracking-[0.14em] text-[#b9d0ee]/85',
  town: 'text-[10.5px] font-medium tracking-[0.06em] text-[#8ea6c8]/80',
  area: 'text-[10px] tracking-[0.05em] text-[#7f97b8]/75',
  poi: 'text-[9.5px] italic tracking-[0.04em] text-[#6f88ab]/75',
} as const;

const defaultFilters: CameraMapFilters = {
  status: 'all',
  departments: [],
  codecs: [],
  anprOnly: false,
  aiOnly: false,
  query: '',
};

/**
 * GIS Camera Map workspace: pan/zoom basemap, clustered camera network,
 * marker dossiers, tracked-vehicle replay and fleet statistics. The camera
 * fleet streams from `/api/gis/cameras` (projected onto the SVG world via
 * `latLngToWorld`); the tracked route comes from `/api/gis/vehicles/{plate}`.
 * Mock fixtures render when the backend is unreachable.
 */
export function CameraMap() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gis = useGisCameras();
  const { raw: kpiRaw } = useDashboardKpis(24);

  const { containerRef, size, project, view, zoomLevel, isPanning, zoomIn, zoomOut, centerOn, handlers } =
    useMapViewport();

  const now = useLiveClock();
  const tick = useTelemetryTick();
  const clock = formatClock(now);

  const [style, setStyle] = useState<BaseMapStyle>('road');
  const [layers, setLayers] = useState<MapLayerState>({
    cameras: true,
    clusters: true,
    alerts: true,
    route: true,
    labels: true,
    heat: false,
  });
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [filters, setFilters] = useState<CameraMapFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [activePlate, setActivePlate] = useState<string | null>(trackedRoute.plate);
  /** Real route when the backend has one for the active plate, else the mock journey. */
  const route = useGisRoute(activePlate);
  const [activeStep, setActiveStep] = useState<number | undefined>(4);
  const [journeyCollapsed, setJourneyCollapsed] = useState(false);
  const [showAlert, setShowAlert] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------------- filtering ---------------- */

  const cameraNodes = useMemo(() => gis.nodes ?? mapCameraNodes, [gis.nodes]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cameraNodes.length, online: 0, offline: 0, warning: 0, critical: 0 };
    cameraNodes.forEach((camera) => {
      counts[camera.status] += 1;
    });
    return counts;
  }, [cameraNodes]);

  const visibleCameras = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return cameraNodes.filter((camera) => {
      if (filters.status !== 'all' && camera.status !== filters.status) return false;
      if (filters.departments.length && !filters.departments.includes(camera.department)) return false;
      if (filters.codecs.length && !filters.codecs.includes(camera.codec)) return false;
      if (filters.anprOnly && !camera.anpr) return false;
      if (filters.aiOnly && !camera.ai) return false;
      if (
        q &&
        !(
          camera.id.toLowerCase().includes(q) ||
          camera.location.toLowerCase().includes(q) ||
          camera.area.toLowerCase().includes(q) ||
          camera.city.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [cameraNodes, filters]);

  /* ---------------- clustering ---------------- */

  const { clusters, singles } = useMemo(() => {
    if (!layers.cameras) return { clusters: [], singles: [] };
    if (!layers.clusters || zoomLevel > 2.6) {
      return {
        clusters: [],
        singles: visibleCameras.map((camera) => {
          const p = project(camera.x, camera.y);
          return { ...camera, sx: p.x, sy: p.y };
        }),
      };
    }
    return buildClusters(visibleCameras, project, 46);
  }, [visibleCameras, project, layers.cameras, layers.clusters, zoomLevel]);

  /* ---------------- selection ---------------- */

  const selectedCamera = selectedId ? cameraNodes.find((c) => c.id === selectedId) ?? null : null;
  const popupCamera = popupId ? cameraNodes.find((c) => c.id === popupId) ?? null : null;
  const popupPos = popupCamera ? project(popupCamera.x, popupCamera.y) : null;

  const handleSelect = useCallback((camera: MapCameraNode) => {
    setSelectedId(camera.id);
    setPopupId(camera.id);
  }, []);

  const handleExpandCluster = useCallback(
    (cluster: Cluster) => {
      const wx = (cluster.x - view.tx) / view.scale;
      const wy = (cluster.y - view.ty) / view.scale;
      centerOn(wx, wy, Math.min(view.scale * 2.1, 6));
    },
    [centerOn, view],
  );

  const handleViewLiveFeed = useCallback(
    (camera: MapCameraNode) => navigate(`/live-view?camera=${camera.id}`),
    [navigate],
  );

  /** Scroll the map back into view when a below-map control jumps the map. */
  const revealMap = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const handleSelectStep = useCallback(
    (step: number) => {
      const node = route?.nodes.find((n) => n.step === step);
      if (!node) return;
      setActiveStep(step);
      setSelectedId(node.cameraId);
      setPopupId(null);
      centerOn(node.x, node.y);
      revealMap();
    },
    [centerOn, route, revealMap],
  );

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
  };

  const goFullscreen = () => {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => undefined);
  };

  /**
   * Screen-space lanes reserved inside the GIS workspace by the floating
   * decks (Map Filters on the left, Selected Camera Intelligence + map
   * controls on the right, legend at the bottom). Markers, the route and the
   * alert callout are clamped to these lanes so nothing spills under a deck
   * or outside the workspace.
   */
  const deckInsets = useMemo(
    () => ({
      top: 16,
      right: selectedCamera ? 420 : 70,
      bottom: 62,
      left: filtersOpen ? 324 : 16,
    }),
    [selectedCamera, filtersOpen],
  );

  /** Read-only analytics snapshot (existing fixture pipeline) rendered below the map. */
  const analytics = useMemo(() => computeAnalytics(defaultAnalyticsFilters), []);

  /* ---------------- render ---------------- */

  return (
    <div className="page-viewport">
      {/* page header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2.5">
            <MapPinned size={20} className="text-accent-cyan" />
            GIS Camera Map
          </h1>
          <p className="page-sub mt-0.5">
            Interactive camera network, live status and vehicle movement intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLayerMenuOpen((open) => !open)}
            className={`flex h-[32px] items-center gap-1.5 rounded-[4px] border px-3 text-[12px] transition-colors ${
              layerMenuOpen
                ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                : 'border-edge bg-panel text-[#c3cfe2] hover:border-edge-strong'
            }`}
          >
            <Layers size={13} /> Layers
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`flex h-[32px] items-center gap-1.5 rounded-[4px] border px-3 text-[12px] transition-colors ${
              filtersOpen
                ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                : 'border-edge bg-panel text-[#c3cfe2] hover:border-edge-strong'
            }`}
          >
            <Filter size={13} /> Filters
          </button>
          <button
            type="button"
            onClick={goFullscreen}
            className="flex h-[32px] items-center gap-1.5 rounded-[4px] border border-edge bg-panel px-3 text-[12px] text-[#c3cfe2] transition-colors hover:border-edge-strong"
          >
            <Maximize size={13} /> Fullscreen
          </button>
          <button
            type="button"
            onClick={refresh}
            className="flex h-[32px] items-center gap-1.5 rounded-[4px] border border-edge bg-panel px-3 text-[12px] text-[#c3cfe2] transition-colors hover:border-edge-strong"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
            {refreshing ? 'Syncing…' : 'Refresh'}
          </button>
          <span className="tnum ml-1 rounded-[4px] border border-edge bg-panel px-2.5 py-[6px] text-[12.5px] text-[#c3cfe2]">
            {clock}
          </span>
        </div>
      </div>

      <MapStatsStrip
        stats={
          gis.live
            ? {
                total: cameraNodes.length.toLocaleString('en-IN'),
                online: {
                  value: statusCounts.online.toLocaleString('en-IN'),
                  pct: `${Math.round((statusCounts.online / Math.max(1, cameraNodes.length)) * 100)}%`,
                },
                offline: {
                  value: statusCounts.offline.toLocaleString('en-IN'),
                  pct: `${Math.round((statusCounts.offline / Math.max(1, cameraNodes.length)) * 100)}%`,
                },
                warning: {
                  value: statusCounts.warning.toLocaleString('en-IN'),
                  pct: `${Math.round((statusCounts.warning / Math.max(1, cameraNodes.length)) * 100)}%`,
                },
                activeAlerts: kpiRaw?.active_alerts ?? 0,
              }
            : undefined
        }
      />

      {/* ---------- GIS map workspace (contained, fixed desktop height) ---------- */}
      <div
        ref={canvasRef}
        className="gis-map-workspace relative h-[560px] w-full shrink-0 overflow-hidden rounded-md border border-edge bg-[#061224] md:h-[620px] xl:h-[660px]"
      >
        <div
          ref={containerRef}
          {...handlers}
          onClick={() => {
            setPopupId(null);
            setLayerMenuOpen(false);
          }}
          className={`absolute inset-0 touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {/* transformed basemap */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: WORLD_W,
              height: WORLD_H,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            }}
          >
            <BaseMap style={style} />
          </div>

          {/* coverage heatmap */}
          {layers.heat && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <filter id="cm-heat" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="18" />
                </filter>
              </defs>
              <g filter="url(#cm-heat)" opacity="0.45">
                {visibleCameras.map((camera) => {
                  const p = project(camera.x, camera.y);
                  return (
                    <circle key={camera.id} cx={p.x} cy={p.y} r={26} fill={statusColor[camera.status]} opacity={0.35} />
                  );
                })}
              </g>
            </svg>
          )}

          {/* labels */}
          {layers.labels && (
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
          )}

          {/* tracked vehicle route */}
          {route && layers.route && activePlate === route.plate && (
            <RouteLayer
              route={route}
              project={project}
              bounds={{ w: size.w, h: size.h }}
              insets={deckInsets}
              showAlert={showAlert && layers.alerts}
              activeStep={activeStep}
              onSelectStep={handleSelectStep}
              onDismissAlert={() => setShowAlert(false)}
              onViewDetails={() => {
                const last = route.nodes[route.nodes.length - 1];
                if (last) {
                  setSelectedId(last.cameraId);
                  setPopupId(last.cameraId);
                }
              }}
              onTrackVehicle={() => {
                setActivePlate(route.plate);
                setJourneyCollapsed(false);
                const mid = route.nodes[Math.floor(route.nodes.length / 2)];
                if (mid) centerOn(mid.x, mid.y, Math.max(view.scale, 1.1));
                revealMap();
              }}
            />
          )}

          {/* camera markers */}
          {layers.cameras && (
            <CameraMarkerLayer
              clusters={clusters}
              singles={singles}
              selectedId={selectedId ?? undefined}
              onSelect={handleSelect}
              onExpandCluster={handleExpandCluster}
            />
          )}

          {/* marker popup */}
          {popupCamera && popupPos && (
            <CameraPopup
              camera={popupCamera}
              x={popupPos.x}
              y={popupPos.y}
              bounds={{ w: size.w, h: size.h }}
              insets={deckInsets}
              onClose={() => setPopupId(null)}
              onViewLiveFeed={handleViewLiveFeed}
            />
          )}
        </div>

        {/* floating decks */}
        {filtersOpen && (
          <MapFilterPanel
            filters={filters}
            counts={statusCounts}
            visibleCount={visibleCameras.length}
            totalCount={cameraNodes.length}
            onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
            onReset={() => setFilters(defaultFilters)}
          />
        )}

        <MapControls
          style={style}
          onStyleChange={setStyle}
          layers={layers}
          onLayerToggle={(key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
          layerMenuOpen={layerMenuOpen}
          onLayerMenuToggle={() => setLayerMenuOpen((open) => !open)}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onLocate={() => centerOn(700, 560, 1.4)}
          onFullscreen={goFullscreen}
          zoomLevel={zoomLevel}
          rightOffset={selectedCamera ? 384 : 12}
        />

        {selectedCamera && (
          <MapCameraIntelPanel
            camera={selectedCamera}
            tick={tick}
            clock={clock}
            onClose={() => setSelectedId(null)}
            onViewLiveFeed={handleViewLiveFeed}
          />
        )}

        <MapLegend />
      </div>

      {/* ---------- Vehicle Journey (normal document flow, below the map) ---------- */}
      <JourneyPanel
        route={route ?? undefined}
        activePlate={activePlate}
        onSelectPlate={(plate) => {
          setActivePlate(plate);
          if (plate) setJourneyCollapsed(false);
          revealMap();
        }}
        activeStep={activeStep}
        onSelectStep={handleSelectStep}
        collapsed={journeyCollapsed}
        onToggleCollapse={() => setJourneyCollapsed((c) => !c)}
      />

      {/* ---------- Analytics (normal document flow, below Vehicle Journey) ---------- */}
      <section aria-label="Analytics" className="flex shrink-0 flex-col gap-2.5">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[5px] bg-accent-blue/15 text-accent-cyan">
              <TrendingUp size={14} strokeWidth={2.2} />
            </span>
            <h2 className="panel-title">Analytics</h2>
            <span className="page-sub hidden sm:inline">network detections, watchlist matches &amp; AI event mix</span>
          </div>
          <span className="tnum rounded-[4px] border border-edge bg-panel px-2.5 py-1 text-[12px] text-[#7286a6]">
            {analytics.windowNote}
          </span>
        </header>

        <div className="responsive-band responsive-band-mid grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,26fr)_minmax(270px,27fr)]">
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <VehicleDetectionTrend snapshot={analytics} />
          </div>
          <div className="min-w-0">
            <WatchlistMatchTrendPanel series={analytics.watchlistTrend} windowNote={analytics.windowNote} />
          </div>
          <div className="min-w-0">
            <AiEventsByTypePanel events={analytics.eventTypes} total={analytics.kpis.events} windowNote={analytics.windowNote} />
          </div>
        </div>
      </section>
    </div>
  );
}
