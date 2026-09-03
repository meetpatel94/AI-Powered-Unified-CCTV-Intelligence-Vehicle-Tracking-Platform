import { FolderOpen, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { Association, EventTone } from '@/types/investigation';

interface RelatedVehiclesPanelProps {
  associations: Association[];
  cameraCount: number;
  onOpen: (association: Association) => void;
  onAddToWatchlist: (association: Association) => void;
}

const toneText: Record<EventTone, string> = {
  red: 'text-[#ff8b96]',
  orange: 'text-[#f7b95f]',
  yellow: 'text-[#eddb6a]',
  green: 'text-[#6fe0b0]',
  blue: 'text-[#9fc7ff]',
  purple: 'text-[#d8b4fe]',
  cyan: 'text-[#67e8f9]',
};

const actionBtn =
  'flex h-[20px] shrink-0 items-center gap-1 rounded-[3px] border border-edge bg-[#0d1626] px-1.5 text-[10.5px] font-semibold text-[#9fc7ff] transition-colors';

/**
 * RELATED VEHICLES / POSSIBLE ASSOCIATIONS: entities co-detected with the
 * target (convoy, same gantries, time-correlated) plus registry links. Only
 * rendered by the page when the dossier actually has associations.
 */
export function RelatedVehiclesPanel({ associations, cameraCount, onOpen, onAddToWatchlist }: RelatedVehiclesPanelProps) {
  return (
    <Panel
      title="Related Vehicles"
      tools={<span className="tnum shrink-0 text-3xs text-ink-dim">{associations.length} linked entities</span>}
      className="h-full min-h-0"
      bodyClassName="scroll-thin flex min-h-0 flex-col gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {associations.map((association) => {
        const Icon = association.icon;
        return (
          <article
            key={association.id}
            className="flex shrink-0 gap-2 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5 transition-colors hover:border-edge-strong hover:bg-panel-hover"
          >
            <span className="relative h-[42px] w-[58px] shrink-0 overflow-hidden rounded-[4px] border border-edge-soft">
              <img src={association.thumbnail} alt="" className="h-full w-full object-cover" />
              <span
                className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/75 py-px text-[9px] font-bold uppercase tracking-[0.06em] ${
                  association.watchlist ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'
                }`}
              >
                {association.watchlist ? <ShieldAlert size={7} /> : <ShieldCheck size={7} />}
                {association.watchlist ? 'watchlist' : 'clear'}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon size={11} className={`shrink-0 ${toneText[association.tone]}`} />
                <span className="tnum truncate font-mono text-[12.5px] font-bold tracking-[0.05em] text-white">
                  {association.label}
                </span>
                <span className="ml-auto shrink-0 rounded-[3px] bg-[#16233a] px-1 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#9fb0cc]">
                  {association.kindLabel}
                </span>
              </div>
              <div className="truncate text-[10.5px] text-[#94a5c2]">{association.sub}</div>
              <p className="mt-[3px] line-clamp-2 text-[10.5px] leading-[12px] text-[#8ea1c0]">{association.detail}</p>

              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className="tnum min-w-0 truncate text-[10px] text-[#7f93b3]">
                  {association.kind === 'registered-owner'
                    ? 'Registry link · no camera co-detection'
                    : `${association.score}/${cameraCount} shared gantries`}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onAddToWatchlist(association)}
                    className={`${actionBtn} hover:border-accent-red/60 hover:text-[#ff8b96]`}
                  >
                    <ShieldAlert size={9} />
                    Watchlist
                  </button>
                  <button
                    type="button"
                    disabled={!association.targetId}
                    title={
                      association.targetId
                        ? 'Open this entity in the investigation console'
                        : 'No dossier for this entity yet'
                    }
                    onClick={() => onOpen(association)}
                    className="flex h-[20px] shrink-0 items-center gap-1 rounded-[3px] border border-accent-blue/45 bg-[#12233f] px-1.5 text-[10.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-blue/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FolderOpen size={9} />
                    Dossier
                  </button>
                </span>
              </div>

              {association.sightings.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {association.sightings.map((code) => (
                    <span
                      key={code}
                      className="tnum rounded-[3px] border border-edge bg-[#0d1626] px-1 py-px text-[9.5px] text-[#7f93b3]"
                    >
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
        <div className="grid flex-1 place-items-center rounded-[5px] border border-dashed border-edge px-3 text-center text-[11.5px] text-ink-dim">
          No co-detected entities for this target in the selected window.
        </div>
      ) : null}
    </Panel>
  );
}
