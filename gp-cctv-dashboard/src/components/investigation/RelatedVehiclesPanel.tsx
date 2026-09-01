import { FolderOpen, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { Association, EventTone } from '@/types/investigation';

interface RelatedVehiclesPanelProps {
  associations: Association[];
  cameraCount: number;
  onOpen: (association: Association) => void;
  onAddToWatchlist: (association: Association) => void;
}

const toneRing: Record<EventTone, string> = {
  red: 'border-accent-red/50 text-[#ff8b96]',
  orange: 'border-accent-orange/50 text-[#f7b95f]',
  yellow: 'border-accent-yellow/50 text-[#eddb6a]',
  green: 'border-accent-green/50 text-[#6fe0b0]',
  blue: 'border-accent-blue/50 text-[#9fc7ff]',
  purple: 'border-accent-purple/50 text-[#d8b4fe]',
  cyan: 'border-accent-cyan/50 text-[#67e8f9]',
};

const toneBar: Record<EventTone, string> = {
  red: 'bg-accent-red',
  orange: 'bg-accent-orange',
  yellow: 'bg-accent-yellow',
  green: 'bg-accent-green',
  blue: 'bg-accent-blue',
  purple: 'bg-accent-purple',
  cyan: 'bg-accent-cyan',
};

/** RELATED VEHICLES / POSSIBLE ASSOCIATIONS: co-detected entities + people. */
export function RelatedVehiclesPanel({ associations, cameraCount, onOpen, onAddToWatchlist }: RelatedVehiclesPanelProps) {
  return (
    <Panel
      title="Related Vehicles / Possible Associations"
      tools={<span className="tnum text-3xs text-ink-dim">{associations.length} linked entities</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {associations.map((association) => {
        const Icon = association.icon;
        const share = cameraCount > 0 ? Math.min(100, (association.score / cameraCount) * 100) : 0;
        return (
          <article
            key={association.id}
            className="flex gap-2 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5 transition-colors hover:border-edge-strong hover:bg-panel-hover"
          >
            <span className="relative h-[42px] w-[58px] shrink-0 overflow-hidden rounded-[4px] border border-edge-soft">
              <img src={association.thumbnail} alt="" className="h-full w-full object-cover" />
              <span
                className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/75 py-px text-[7px] font-bold uppercase tracking-[0.06em] ${toneRing[association.tone].split(' ')[1]}`}
              >
                {association.watchlist ? <ShieldAlert size={7} /> : <ShieldCheck size={7} />}
                {association.watchlist ? 'watchlist' : 'clear'}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Icon size={11} className={`shrink-0 ${toneRing[association.tone].split(' ')[1]}`} />
                <span className="tnum truncate font-mono text-[10.5px] font-bold tracking-[0.05em] text-white">
                  {association.label}
                </span>
                <span className="shrink-0 rounded-[3px] bg-[#16233a] px-1 py-px text-[7.5px] font-semibold uppercase tracking-[0.06em] text-[#9fb0cc]">
                  {association.kindLabel}
                </span>
              </div>
              <div className="truncate text-[8.5px] text-[#94a5c2]">{association.sub}</div>
              <p className="mt-[3px] line-clamp-2 text-[8.5px] leading-[12px] text-[#8ea1c0]">{association.detail}</p>

              <div className="mt-1 flex items-center gap-1.5">
                {association.kind === 'registered-owner' ? (
                  <span className="flex items-center gap-1 text-[8px] text-[#7f93b3]">
                    <UserRound size={9} className="text-accent-purple" />
                    registry link · no camera co-detection
                  </span>
                ) : (
                  <>
                    <span className="h-[3px] w-[54px] shrink-0 overflow-hidden rounded-full bg-[#14243c]">
                      <span className={`block h-full rounded-full ${toneBar[association.tone]}`} style={{ width: `${share}%` }} />
                    </span>
                    <span className="tnum shrink-0 text-[8px] text-[#7f93b3]">
                      {association.score}/{cameraCount} shared gantries
                    </span>
                  </>
                )}

                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onAddToWatchlist(association)}
                    className="flex h-[19px] items-center gap-1 rounded-[3px] border border-edge bg-[#0d1626] px-1.5 text-[8.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-red/60 hover:text-[#ff8b96]"
                  >
                    <ShieldAlert size={9} />
                    Watchlist
                  </button>
                  <button
                    type="button"
                    disabled={!association.targetId}
                    title={association.targetId ? 'Open this entity in the investigation console' : 'No dossier for this entity yet'}
                    onClick={() => onOpen(association)}
                    className="flex h-[19px] items-center gap-1 rounded-[3px] border border-accent-blue/45 bg-[#12233f] px-1.5 text-[8.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-blue/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FolderOpen size={9} />
                    Dossier
                  </button>
                </span>
              </div>

              {association.sightings.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {association.sightings.map((code) => (
                    <span key={code} className="tnum rounded-[3px] border border-edge bg-[#0d1626] px-1 py-px text-[7.5px] text-[#7f93b3]">
                      {code}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}

      {associations.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-[5px] border border-dashed border-edge px-3 text-center text-[9.5px] text-ink-dim">
          No co-detected entities for this target in the selected window.
        </div>
      ) : null}
    </Panel>
  );
}
