import { ChevronDown, Route, Crosshair } from 'lucide-react';

import { trackedRoute, watchlistVehicles } from '@/data/cameraMapData';
import type { TrackedVehicleRoute } from '@/types/cameraMap';

interface JourneyPanelProps {
  activePlate: string | null;
  onSelectPlate: (plate: string | null) => void;
  activeStep?: number;
  onSelectStep: (step: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Real route from `/api/gis/vehicles/{plate}/route`; defaults to the mock journey. */
  route?: TrackedVehicleRoute;
}

/** Bottom investigation dock: pick a vehicle, replay its camera-to-camera route. */
export function JourneyPanel({
  activePlate,
  onSelectPlate,
  activeStep,
  onSelectStep,
  collapsed,
  onToggleCollapse,
  route = trackedRoute,
}: JourneyPanelProps) {
  const active = activePlate === route.plate;
  /** "HH:MM[:SS][ AM]" clock strings → minutes since midnight. */
  const minutesOf = (time: string) => {
    const [h = 0, m = 0] = time.replace(/[^\d:]/g, '').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const span =
    route.nodes.length > 1
      ? `${Math.max(1, minutesOf(route.nodes[route.nodes.length - 1].time) - minutesOf(route.nodes[0].time))}m`
      : '—';

  return (
    <div className="pointer-events-auto absolute bottom-[56px] left-3 right-3 z-30 overflow-hidden rounded-md border border-edge bg-[#0a1220]/96 shadow-panel backdrop-blur-sm">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-edge px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
            <Route size={14} className="text-accent-cyan" />
            Vehicle Journey
          </span>

          <div className="flex items-center gap-1">
            {watchlistVehicles.map((vehicle) => {
              const isActive = activePlate === vehicle.plate;
              return (
                <button
                  key={vehicle.plate}
                  type="button"
                  onClick={() => onSelectPlate(isActive ? null : vehicle.plate)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[13px] transition-colors ${
                    isActive
                      ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan'
                      : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-ink'
                  }`}
                >
                  <span className="font-semibold tracking-wide">{vehicle.plate}</span>
                  {vehicle.watchlist && (
                    <span className="rounded-[2px] bg-accent-red/20 px-1.5 py-px text-[11.5px] font-bold text-[#ff8b96]">
                      WL
                    </span>
                  )}
                  <span className="tnum text-[12px] text-[#6d82a3]">{vehicle.hits} hits</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {active && (
            <span className="flex items-center gap-2 text-[13px] text-ink-dim">
              <span className="tnum">
                <span className="text-[#c3cfe2]">{route.type}</span> · {route.nodes.length} sightings · {span}
              </span>
              <span className="flex items-center gap-1 text-[#ff8b96]">
                <Crosshair size={11} /> watchlist
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand journey' : 'Collapse journey'}
            className="text-[#8ea3c4] transition-transform hover:text-white"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="px-3 py-2.5">
          {!active ? (
            <div className="py-4 text-center text-[12.5px] text-ink-dim">
              Select a vehicle above to replay its tracked route across the camera network.
            </div>
          ) : (
            <div className="flex items-stretch gap-2.5">
              {route.nodes.map((node, index) => {
                const isActive = activeStep === node.step;
                return (
                  <div key={node.step} className="flex min-w-0 flex-1 items-stretch gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectStep(node.step)}
                      className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-[5px] border px-2.5 py-2 text-left transition-colors ${
                        node.critical
                          ? 'border-accent-red/70 bg-accent-red/10'
                          : isActive
                            ? 'border-accent-cyan/60 bg-accent-cyan/10'
                            : 'border-edge bg-[#0c1424] hover:border-edge-strong'
                      }`}
                    >
                      <span
                        className={`tnum grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[12.5px] font-bold text-white ${
                          node.critical ? 'bg-accent-red' : 'bg-[#2563eb]'
                        }`}
                      >
                        {node.step}
                      </span>

                      <span className="h-[44px] w-[74px] shrink-0 overflow-hidden rounded-[3px] border border-edge-soft bg-black">
                        <img src={node.thumbnail} alt={node.cameraId} className="h-full w-full object-cover" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-bold tracking-wide text-white">{node.cameraId}</span>
                          <span className="tnum text-[12.5px] text-[#8ea1c0]">{node.time}</span>
                        </span>
                        <span className="block truncate text-[13px] text-[#a9bcd8]">{node.road}</span>
                        <span className="flex items-center gap-1.5 text-[12.5px] text-[#6d82a3]">
                          <span className="truncate">{node.city}</span>
                          <span className="h-[7px] w-px bg-edge-strong" />
                          <span className="tnum">{node.speed}</span>
                          <span className="h-[7px] w-px bg-edge-strong" />
                          <span className="truncate">{node.direction}</span>
                        </span>
                      </span>

                      {node.critical && (
                        <span className="shrink-0 rounded-[2px] bg-accent-red px-1.5 py-px text-[11px] font-bold tracking-wide text-white">
                          ALERT
                        </span>
                      )}
                    </button>

                    {index < route.nodes.length - 1 && (
                      <span className="flex shrink-0 items-center">
                        <span
                          className={`h-px w-4 ${
                            route.nodes[index + 1].critical ? 'bg-accent-red/70' : 'bg-accent-cyan/50'
                          }`}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
