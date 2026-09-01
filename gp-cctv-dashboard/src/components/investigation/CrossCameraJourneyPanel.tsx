import {
  ArrowRight,
  Clock3,
  Crosshair,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  ScanSearch,
  ShieldAlert,
  Video,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { JourneyRouteMap } from '@/components/investigation/JourneyRouteMap';
import type { InvestigationDossier, RouteLeg, VehicleSighting } from '@/types/investigation';

interface CrossCameraJourneyPanelProps {
  dossier: InvestigationDossier;
  legs: RouteLeg[];
  nodes: VehicleSighting[];
  activeStep: number | null;
  onSelectStep: (step: number) => void;
  onOpenEvidence: (sightingId: string) => void;
  onViewCamera: (cameraId: string) => void;
  frameToken: number;
  playing: boolean;
  onToggleReplay: () => void;
}

const iconBtn =
  'grid h-[20px] w-[20px] place-items-center rounded-[3px] border border-edge bg-[#0c1424] text-[#8ea3c4] transition-colors hover:border-accent-cyan/60 hover:text-[#67e8f9]';

/**
 * CROSS-CAMERA JOURNEY: the horizontal sighting timeline (snapshots, numbered
 * nodes, connected legs) paired with the GIS reconstruction. Selecting a node
 * focuses the map; the evidence / camera buttons drill into a single sighting.
 */
export function CrossCameraJourneyPanel({
  dossier,
  legs,
  nodes,
  activeStep,
  onSelectStep,
  onOpenEvidence,
  onViewCamera,
  frameToken,
  playing,
  onToggleReplay,
}: CrossCameraJourneyPanelProps) {
  const totalKm = legs.reduce((sum, leg) => sum + leg.km, 0);
  const totalSec = legs.reduce((sum, leg) => sum + leg.seconds, 0);

  return (
    <Panel
      title="Cross-Camera Journey"
      tools={
        <div className="flex items-center gap-1.5">
          <span className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[8.5px] text-[#8ea3c4]">
            {nodes.length} route nodes · {legs.length} legs · {totalKm.toFixed(1)} km · {Math.floor(totalSec / 60)} min{' '}
            {String(totalSec % 60).padStart(2, '0')} s
          </span>
          <div className="flex items-center gap-px overflow-hidden rounded-[4px] border border-edge bg-[#0a1120] p-px">
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                title={`${node.cameraId} · ${node.time}`}
                onClick={() => node.journeyStep && onSelectStep(node.journeyStep)}
                className={`tnum h-[20px] w-[20px] text-[9px] font-bold transition-colors ${
                  activeStep === node.journeyStep
                    ? node.watchlistHit
                      ? 'bg-accent-red text-white'
                      : 'bg-[#2563eb] text-white'
                    : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
                }`}
              >
                {node.journeyStep}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleReplay}
            className={`flex h-[22px] items-center gap-1 rounded-[4px] border px-2 text-[9px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              playing
                ? 'border-accent-cyan/60 bg-[#083344]/70 text-[#67e8f9]'
                : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
            }`}
          >
            {playing ? <Pause size={10} /> : <Play size={10} />}
            {playing ? 'Pause replay' : 'Replay route'}
          </button>
        </div>
      }
      className="min-h-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="flex h-full min-h-0 gap-2.5">
        {/* timeline */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex items-center gap-1.5 text-[8.5px] text-[#6d7f9e]">
            <RouteIcon size={10} className="text-accent-cyan" />
            <span className="uppercase tracking-[0.09em]">Movement reconstruction</span>
            <span className="truncate text-[#55668a]">
              · ANPR chain across {dossier.target.plate} · confidence-weighted matching · {dossier.unit}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-stretch gap-0 overflow-x-auto pb-1">
            {nodes.map((node, index) => {
              const leg = legs[index];
              const active = activeStep === node.journeyStep;
              const critical = Boolean(node.watchlistHit);
              return (
                <div key={node.id} className="flex min-w-0 shrink-0 items-stretch">
                  <button
                    type="button"
                    onClick={() => node.journeyStep && onSelectStep(node.journeyStep)}
                    className={`group flex w-[178px] flex-col rounded-[6px] border px-2 pb-1.5 pt-1.5 text-left transition-all ${
                      active
                        ? critical
                          ? 'border-accent-red/70 bg-[#2a0d13]/60 shadow-[0_0_16px_-6px_rgba(239,68,68,0.9)]'
                          : 'border-accent-cyan/70 bg-[#083344]/40 shadow-glow'
                        : 'border-edge bg-[#0c1424] hover:border-edge-strong hover:bg-panel-hover'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`tnum grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[9px] font-bold text-white ${
                          critical ? 'border-white/80 bg-accent-red' : 'border-white/70 bg-[#2563eb]'
                        }`}
                        style={{ boxShadow: critical ? '0 0 10px rgba(239,68,68,0.8)' : '0 0 8px rgba(37,99,235,0.8)' }}
                      >
                        {node.journeyStep}
                      </span>
                      <span className="tnum font-mono text-[11px] font-bold tracking-[0.06em] text-white">{node.cameraId}</span>
                      <span className="tnum ml-auto text-[8.5px] text-[#8ea3c4]">{node.time}</span>
                    </div>

                    <div className="mt-[2px] flex items-center gap-1 truncate text-[9px] text-[#94a5c2]">
                      <MapPin size={9} className="shrink-0 text-accent-cyan" />
                      <span className="truncate">{node.location}</span>
                      <span className="shrink-0 text-[#55668a]">· {node.city}</span>
                    </div>

                    <div className="relative mt-1 h-[58px] overflow-hidden rounded-[4px] border border-edge-soft bg-black">
                      <img src={node.thumbnail} alt={`${node.cameraId} snapshot`} className="h-full w-full object-cover" />
                      {critical ? <span className="absolute inset-0 bg-accent-red/15 ring-1 ring-inset ring-accent-red/50" /> : null}
                      <span className="absolute left-1 top-1 rounded-[2px] bg-black/75 px-1 py-px text-[7.5px] font-semibold text-[#c9d6ea]">
                        step {node.journeyStep}
                      </span>
                      <span className="tnum absolute bottom-1 right-1 rounded-[2px] bg-black/75 px-1 py-px text-[7.5px] font-semibold text-[#67e8f9]">
                        {node.confidence.toFixed(1)}%
                      </span>
                      {critical ? (
                        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-[2px] bg-[#2a0d13]/90 px-1 py-px text-[7px] font-bold uppercase text-[#ff8b96]">
                          <ShieldAlert size={7} /> watchlist
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[8px] text-[#7f93b3]">
                      <span className="tnum flex items-center gap-1">
                        <Navigation size={9} className="text-[#6d82a3]" />
                        {node.direction} · {node.speedKph} km/h
                      </span>
                      <span className="tnum">{node.zone.split('·').pop()?.trim()}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-1">
                      <span
                        role="presentation"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenEvidence(node.id);
                        }}
                        className={`${iconBtn} cursor-pointer`}
                        title="Open evidence for this sighting"
                      >
                        <ScanSearch size={11} />
                      </span>
                      <span
                        role="presentation"
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewCamera(node.cameraId);
                        }}
                        className={`${iconBtn} cursor-pointer`}
                        title={`Open ${node.cameraId} on Live View`}
                      >
                        <Video size={11} />
                      </span>
                      <span className="tnum ml-auto truncate text-[7.5px] text-[#55668a]">{node.clip}</span>
                    </div>
                  </button>

                  {leg ? (
                    <div className="flex w-[92px] shrink-0 flex-col items-center justify-center px-1">
                      <span className="tnum rounded-[3px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[8px] font-semibold text-[#9fc7ff]">
                        {leg.label.replace(' min ', 'm ').replace(' s', 's')}
                      </span>
                      <span className="relative mt-1 flex w-full items-center">
                        <span
                          className={`h-px w-full border-t border-dashed ${leg.critical ? 'border-accent-red/70' : 'border-accent-cyan/60'}`}
                        />
                        <ArrowRight
                          size={11}
                          className={`absolute -right-0.5 ${leg.critical ? 'text-accent-red' : 'text-accent-cyan'}`}
                        />
                      </span>
                      <span className="tnum mt-1 text-[7.5px] text-[#6d82a3]">
                        {leg.km.toFixed(1)} km · avg {leg.speedKph} km/h
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex items-center gap-2 border-t border-edge-soft pt-1 text-[8px] text-[#6d82a3]">
            <span className="flex items-center gap-1">
              <Clock3 size={9} className="text-accent-cyan" />
              {nodes[0]?.time} → {nodes[nodes.length - 1]?.time}
            </span>
            <span className="flex items-center gap-1">
              <Crosshair size={9} className="text-accent-green" />
              chain integrity {dossier.target.meanConfidence.toFixed(1)}% · no gap &gt; 10 min
            </span>
            <span className="ml-auto flex items-center gap-1">
              <ShieldAlert size={9} className="text-accent-red" />
              terminal node flagged by the watchlist engine
            </span>
          </div>
        </div>

        {/* mini map */}
        <div className="h-full w-[392px] shrink-0">
          <JourneyRouteMap
            legs={legs}
            nodes={nodes}
            activeStep={activeStep}
            onSelectStep={onSelectStep}
            frameToken={frameToken}
          />
        </div>
      </div>
    </Panel>
  );
}
