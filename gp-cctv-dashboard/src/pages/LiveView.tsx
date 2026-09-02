import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AnprFeedPanel } from '@/components/liveview/AnprFeedPanel';
import { LiveCameraCard } from '@/components/liveview/LiveCameraCard';
import { LiveViewHeader, type GridSize } from '@/components/liveview/LiveViewHeader';
import { SelectedCameraPanel } from '@/components/liveview/SelectedCameraPanel';
import { StreamHealthPanel } from '@/components/liveview/StreamHealthPanel';
import { liveCameras } from '@/data/liveViewData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useTelemetryTick } from '@/hooks/useTelemetryTick';
import type { CameraFilterId } from '@/types/liveView';

const gridColumns: Record<GridSize, string> = {
  2: 'grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))]',
  3: 'grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]',
  4: 'grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]',
};

/**
 * Live CCTV Monitoring workspace: filterable camera wall on the left,
 * selected-camera intelligence + ANPR ticker + stream health on the right.
 */
export function LiveView() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CameraFilterId>('all');
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [searchParams] = useSearchParams();
  const deepLinkedCamera = searchParams.get('camera');
  const [selectedId, setSelectedId] = useState(
    () => (deepLinkedCamera && liveCameras.some((c) => c.id === deepLinkedCamera) ? deepLinkedCamera : 'C-038'),
  );
  const [mutedIds, setMutedIds] = useState<string[]>(() => liveCameras.map((c) => c.id));

  const now = useLiveClock();
  const tick = useTelemetryTick();
  const clock = formatClock(now);

  const counts = useMemo(
    () => ({
      total: liveCameras.length,
      online: liveCameras.filter((c) => ['online', 'critical', 'warning'].includes(c.status)).length,
      offline: liveCameras.filter((c) => c.status === 'offline').length,
      unavailable: liveCameras.filter((c) => ['offline', 'reconnecting'].includes(c.status)).length,
      critical: liveCameras.filter((c) => c.status === 'critical').length,
      anpr: liveCameras.filter((c) => c.anprActive).length,
      ai: liveCameras.filter((c) => c.aiDetection).length,
    }),
    [],
  );

  const visibleCameras = useMemo(() => {
    const q = query.trim().toLowerCase();

    return liveCameras.filter((camera) => {
      const matchesQuery =
        !q ||
        camera.id.toLowerCase().includes(q) ||
        camera.location.toLowerCase().includes(q) ||
        camera.city.toLowerCase().includes(q) ||
        camera.zone.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      switch (filter) {
        case 'online':
          return ['online', 'critical', 'warning'].includes(camera.status);
        case 'offline':
          return camera.status === 'offline' || camera.status === 'reconnecting';
        case 'critical':
          return camera.status === 'critical' || Boolean(camera.alertLabel);
        case 'anpr':
          return camera.anprActive;
        case 'ai':
          return camera.aiDetection;
        default:
          return true;
      }
    });
  }, [query, filter]);

  const selectedCamera =
    liveCameras.find((camera) => camera.id === selectedId) ?? visibleCameras[0] ?? liveCameras[0];

  const toggleMute = (id: string) =>
    setMutedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page-viewport">
      <LiveViewHeader
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        counts={counts}
        clock={clock}
      />

      <div className="flex min-h-[640px] flex-1 flex-col gap-[var(--page-gap)] overflow-visible lg:flex-row">
        {/* ---------------- camera wall ---------------- */}
        <div className="flex min-h-[460px] w-full shrink-0 flex-col gap-[var(--page-gap)] lg:min-h-0 lg:shrink lg:flex-1">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-md border border-edge bg-panel">
            <header className="flex shrink-0 items-center justify-between gap-3 px-3.5 pb-2 pt-2.5">
            <h2 className="panel-title">
              Camera Wall
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-dim">
                showing {visibleCameras.length} of {liveCameras.length} feeds
              </span>
            </h2>
            <span className="flex items-center gap-3 text-3xs text-ink-dim">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" /> AI overlay on
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" /> recording
              </span>
            </span>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {visibleCameras.length === 0 ? (
              <div className="grid h-full place-items-center text-[13px] text-ink-dim">
                No cameras match the current filters.
              </div>
            ) : (
              <div className={`grid gap-3.5 ${gridColumns[gridSize]}`}>
                {visibleCameras.map((camera) => (
                  <LiveCameraCard
                    key={camera.id}
                    camera={camera}
                    selected={camera.id === selectedId}
                    muted={mutedIds.includes(camera.id)}
                    clock={clock}
                    tick={tick}
                    compact={gridSize === 4}
                    onSelect={setSelectedId}
                    onToggleMute={toggleMute}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

          <StreamHealthPanel tick={tick} />
        </div>

        {/* ---------------- intelligence rail ---------------- */}
        <aside className="flex w-full min-w-0 shrink-0 flex-row gap-[var(--page-gap)] lg:w-[360px] lg:min-w-[330px] lg:flex-col lg:overflow-y-auto lg:pr-0.5">
          <div className="min-w-0 flex-1 lg:flex-none lg:shrink-0">
            <SelectedCameraPanel camera={selectedCamera} clock={clock} tick={tick} />
          </div>
          <div className="min-h-[300px] min-w-0 flex-1 lg:min-h-[260px]">
            <AnprFeedPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
