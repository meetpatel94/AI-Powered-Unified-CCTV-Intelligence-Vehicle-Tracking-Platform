import {
  ArrowRight,
  Clock3,
  Crosshair,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radar,
  Route as RouteIcon,
  ScanSearch,
  ShieldAlert,
  Timer,
  Video,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { JourneyRouteMap } from '@/components/investigation/JourneyRouteMap';
import type { InvestigationDossier, RouteAnalysis, RouteLeg, VehicleSighting } from '@/types/investigation';

interface CrossCameraJourneyPanelProps {
  dossier: InvestigationDossier;
  legs: RouteLeg[];
  nodes: VehicleSighting[];
  activeStep: number | null;
  onSelectStep: (step: number) => void;
  onOpenEvidence: (sightingId: string) => void;
  onViewCamera: (cameraId: string) => void;
  onTrackLive: () => void;
  analysis: RouteAnalysis;
  frameToken: number;
  playing: boolean;
  onToggleReplay: () => void;
}

const iconBtn =
  'grid h-[21px] w-[21px] shrink-0 place-items-center rounded-[3px] border border-edge bg-[#0c1424] text-[#8ea3c4] transition-colors hover:border-accent-cyan/60 hover:text-[#67e8f9]';

const toolBtn =
  'flex h-[22px] shrink-0 items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8ea3c4] transition-colors hover:border-edge-strong hover:text-white';

/**
 * CROSS-CAMERA VEHICLE JOURNEY / ROUTE RECONSTRUCTION: the full-width ANPR
 * chain (numbered nodes, camera IDs, timestamps, per-leg distance + duration)
 * beside the GIS reconstruction. Replay steps the active node, live tracking
 * hands the target to the map, and every node drills into its own camera.
 */
export function CrossCameraJourneyPanel({
  dossier,
  legs,
  nodes,
  activeStep,
  onSelectStep,
  onOpenEvidence,
  onViewCamera,
  onTrackLive,
  analysis,
  frameToken,
  playing,
  onToggleReplay,
}: CrossCameraJourneyPanelProps) {
  const totalKm = legs.reduce((sum, leg) => sum + leg.km, 0);
  const totalSec = legs.reduce((sum, leg) => sum + leg.seconds, 0);
  const activeNode = nodes.find((node) => node.journeyStep === activeStep) ?? nodes[nodes.length - 1];
  const terminalFlagged = Boolean(nodes[nodes.length - 1]?.watchlistHit);

  return (
    <Panel
      title="Cross-Camera Vehicle Journey"
      headerClassName="flex-wrap gap-y-1.5"
      tools={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[10.5px] text-[#8ea3c4]">
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
                className={`tnum h-[21px] w-[21px] text-[11px] font-bold transition-colors ${
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
            className={`flex h-[22px] shrink-0 items-center gap-1 rounded-[4px] border px-2 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              playing
                ? 'border-accent-cyan/60 bg-[#083344]/70 text-[#67e8f9]'
                : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
            }`}
          >
            {playing ? <Pause size={10} /> : <Play size={10} />}
            {playing ? 'Pause replay' : 'Replay route'}
          </button>
          <button
            type="button"
            onClick={onTrackLive}
            className="flex h-[22px] shrink-0 items-center gap-1 rounded-[4px] border border-accent-cyan/45 bg-[#083344]/50 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#67e8f9] transition-colors hover:border-accent-cyan/70 hover:text-white"
          >
            <Radar size={10} />
            Live tracking
          </button>
          <button
            type="button"
            onClick={() => activeNode && onViewCamera(activeNode.cameraId)}
            disabled={!activeNode}
            className={`${toolBtn} disabled:cursor-not-allowed disabled:opacity-40`}
            title={activeNode ? `Open ${activeNode.cameraId} on Live View` : 'No route node selected'}
          >
            <Video size={10} />
            {activeNode ? `View ${activeNode.cameraId}` : 'View camera'}
          </button>
        </div>
      }
      className="h-full min-h-0 shrink-0"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="flex min-h-0 flex-col gap-2.5 xl:flex-row">
        {/* ANPR chain */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-[#6d7f9e]">
            <RouteIcon size={10} className="shrink-0 text-accent-cyan" />
            <span className="shrink-0 uppercase tracking-[0.09em]">Movement reconstruction</span>
            <span className="min-w-0 truncate text-[#55668a]">
              · ANPR chain across {dossier.target.plate} · confidence-weighted matching · {dossier.unit}
            </span>
          </div>

          <div className="scroll-thin flex min-h-0 flex-1 items-stretch overflow-x-auto pb-1">
            {nodes.map((node, index) => {
              const leg = legs[index];
              const active = activeStep === node.journeyStep;
              const critical = Boolean(node.watchlistHit);
              return (
                <div
                  key={node.id}
                  className={`flex min-w-0 flex-1 items-stretch ${leg ? 'min-w-[320px]' : 'min-w-[214px]'}`}
                >
                  <button
                    type="button"
                    onClick={() => node.journeyStep && onSelectStep(node.journeyStep)}
                    className={`group flex min-w-0 flex-1 basis-[214px] flex-col rounded-[6px] border px-2 pb-1.5 pt-1.5 text-left transition-all ${
                      active
                        ? critical
                          ? 'border-accent-red/70 bg-[#2a0d13]/60 shadow-[0_0_16px_-6px_rgba(239,68,68,0.9)]'
                          : 'border-accent-cyan/70 bg-[#083344]/40 shadow-glow'
                        : 'border-edge bg-[#0c1424] hover:border-edge-strong hover:bg-panel-hover'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`tnum grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[11px] font-bold text-white ${
                          critical ? 'border-white/80 bg-accent-red' : 'border-white/70 bg-[#2563eb]'
                        }`}
                        style={{ boxShadow: critical ? '0 0 10px rgba(239,68,68,0.8)' : '0 0 8px rgba(37,99,235,0.8)' }}
                      >
                        {node.journeyStep}
                      </span>
                      <span className="tnum truncate font-mono text-[13px] font-bold tracking-[0.06em] text-white">
                        {node.cameraId}
                      </span>
                      <span className="tnum ml-auto shrink-0 text-[10.5px] text-[#8ea3c4]">{node.time}</span>
                    </div>

                    <div className="mt-[2px] flex min-w-0 items-center gap-1 text-[11px] text-[#94a5c2]">
                      <MapPin size={9} className="shrink-0 text-accent-cyan" />
                      <span className="truncate">{node.location}</span>
                      <span className="shrink-0 text-[#55668a]">· {node.city}</span>
                    </div>

                    <div className="relative mt-1 min-h-[64px] flex-1 overflow-hidden rounded-[4px] border border-edge-soft bg-black">
                      <img src={node.thumbnail} alt={`${node.cameraId} snapshot`} className="h-full w-full object-cover" />
                      {critical ? (
                        <span className="absolute inset-0 bg-accent-red/15 ring-1 ring-inset ring-accent-red/50" />
                      ) : null}
                      <span className="tnum absolute bottom-1 right-1 rounded-[2px] bg-black/75 px-1 py-px text-[9.5px] font-semibold text-[#67e8f9]">
                        {node.confidence.toFixed(1)}%
                      </span>
                      {critical ? (
                        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-[2px] bg-[#2a0d13]/90 px-1 py-px text-[9px] font-bold uppercase text-[#ff8b96]">
                          <ShieldAlert size={7} /> watchlist
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 flex min-w-0 items-center justify-between gap-1 text-[10px] text-[#7f93b3]">
                      <span className="tnum flex min-w-0 items-center gap-1">
                        <Navigation size={9} className="shrink-0 text-[#6d82a3]" />
                        <span className="truncate">
                          {node.direction} · {node.speedKph} km/h
                        </span>
                      </span>
                      <span className="tnum shrink-0">{node.zone.split('·').pop()?.trim()}</span>
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
                      <span className="tnum ml-auto min-w-0 truncate text-[9.5px] text-[#55668a]">{node.clip}</span>
                    </div>
                  </button>

                  {leg ? (
                    <div className="flex w-[104px] shrink-0 flex-col items-center justify-center px-1">
                      <span className="tnum flex items-center gap-1 rounded-[3px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[10px] font-semibold text-[#9fc7ff]">
                        <Clock3 size={9} className="text-accent-cyan" />
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
                      <span className="tnum mt-1 text-center text-[9.5px] leading-[11px] text-[#6d82a3]">
                        {leg.km.toFixed(1)} km · avg {leg.speedKph} km/h
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge-soft pt-1 text-[10px] text-[#6d82a3]">
            <span className="tnum flex items-center gap-1">
              <Clock3 size={9} className="text-accent-cyan" />
              {nodes[0]?.time} → {nodes[nodes.length - 1]?.time}
            </span>
            <span className="tnum flex items-center gap-1">
              <Crosshair size={9} className="text-accent-green" />
              chain integrity {dossier.target.meanConfidence.toFixed(1)}%
            </span>
            <span className="tnum flex items-center gap-1">
              <Timer size={9} className="text-accent-orange" />
              longest gap {Math.floor(analysis.longestGap.seconds / 60)}m {analysis.longestGap.seconds % 60}s ·{' '}
              {analysis.longestGap.label}
            </span>
            {terminalFlagged ? (
              <span className="ml-auto flex items-center gap-1 text-[#ff8b96]">
                <ShieldAlert size={9} />
                terminal node flagged by the watchlist engine
              </span>
            ) : null}
          </div>
        </div>

        {/* GIS reconstruction */}
        <div className="h-[clamp(300px,38vh,460px)] w-full shrink-0 xl:w-[clamp(340px,26vw,520px)]">
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
