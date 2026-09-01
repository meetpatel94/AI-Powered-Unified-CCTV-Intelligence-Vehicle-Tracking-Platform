import { ArrowRight, Camera as CameraIcon, CarFront, History, Search, ShieldAlert, UserRound, XCircle } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { EventTone } from '@/types/investigation';
import type { RecentInvestigation, SearchCandidate, SearchMode } from '@/types/investigation';

interface InvestigationSearchPanelProps {
  mode: SearchMode;
  onMode: (mode: SearchMode) => void;
  plate: string;
  onPlate: (value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  onSearch: () => void;
  candidates: SearchCandidate[];
  onSelect: (candidate: SearchCandidate) => void;
  recents: RecentInvestigation[];
  onRecent: (recent: RecentInvestigation) => void;
  activePlate: string;
  fuzzy: boolean;
  onFuzzy: (value: boolean) => void;
  watchlistOnly: boolean;
  onWatchlistOnly: (value: boolean) => void;
  includeReReads: boolean;
  onIncludeReReads: (value: boolean) => void;
  scanning: boolean;
  indexMeta: { cameras: string; plates: string; synced: string };
}

const modes: Array<{ id: SearchMode; label: string; icon: typeof CarFront; hint: string }> = [
  { id: 'vehicle', label: 'Vehicle', icon: CarFront, hint: 'Plate, make / model or registered owner' },
  { id: 'camera', label: 'Camera', icon: CameraIcon, hint: 'Camera ID, road, area or zone' },
  { id: 'person', label: 'Person / Event', icon: UserRound, hint: 'Person of interest, watchlist entry or AI event' },
];

const toneRing: Record<EventTone, string> = {
  red: 'border-accent-red/50 bg-[#2a0d13] text-[#ff8b96]',
  orange: 'border-accent-orange/50 bg-[#2b1a06] text-[#f7b95f]',
  yellow: 'border-accent-yellow/50 bg-[#2b2406] text-[#eddb6a]',
  green: 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]',
  blue: 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]',
  purple: 'border-accent-purple/50 bg-[#22103a] text-[#d8b4fe]',
  cyan: 'border-accent-cyan/50 bg-[#083344] text-[#67e8f9]',
};

const toneDot: Record<EventTone, string> = {
  red: 'bg-accent-red',
  orange: 'bg-accent-orange',
  yellow: 'bg-accent-yellow',
  green: 'bg-accent-green',
  blue: 'bg-accent-blue',
  purple: 'bg-accent-purple',
  cyan: 'bg-accent-cyan',
};

/**
 * The workspace's primary search surface: ANPR plate entry, the quick-search
 * mode switch, candidate results and the recent-investigation chips.
 */
export function InvestigationSearchPanel({
  mode,
  onMode,
  plate,
  onPlate,
  query,
  onQuery,
  onSearch,
  candidates,
  onSelect,
  recents,
  onRecent,
  activePlate,
  fuzzy,
  onFuzzy,
  watchlistOnly,
  onWatchlistOnly,
  includeReReads,
  onIncludeReReads,
  scanning,
  indexMeta,
}: InvestigationSearchPanelProps) {
  const activeMode = modes.find((item) => item.id === mode) ?? modes[0];

  const toggle = (label: string, value: boolean, onChange: (next: boolean) => void, title: string) => (
    <button
      key={label}
      type="button"
      title={title}
      onClick={() => onChange(!value)}
      className={`flex h-[24px] items-center gap-1.5 rounded-[4px] border px-2 text-[9px] font-semibold uppercase tracking-[0.06em] transition-colors ${
        value
          ? 'border-accent-cyan/60 bg-[#083344]/70 text-[#67e8f9]'
          : 'border-edge bg-[#0c1424] text-[#7f93b3] hover:border-edge-strong hover:text-[#c3cfe2]'
      }`}
    >
      <span className={`h-[9px] w-[15px] rounded-full ${value ? 'bg-accent-cyan/35' : 'bg-[#1b2740]'}`}>
        <span
          className={`block h-[9px] w-[7px] rounded-full transition-transform ${
            value ? 'translate-x-[8px] bg-accent-cyan' : 'translate-x-0 bg-[#4b5f83]'
          }`}
        />
      </span>
      {label}
    </button>
  );

  return (
    <Panel
      title="Investigation Search"
      tools={
        <div className="flex items-center gap-1.5">
          <span className="tnum hidden text-3xs text-ink-dim lg:inline">
            ANPR index · {indexMeta.cameras} cameras · {indexMeta.plates} plates today · synced {indexMeta.synced}
          </span>
          <div className="flex items-center gap-px overflow-hidden rounded-[5px] border border-edge bg-[#0a1120] p-px">
            {modes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onMode(id)}
                className={`flex h-[24px] items-center gap-1 rounded-[4px] px-2 text-[9.5px] font-semibold transition-all ${
                  mode === id
                    ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.9)]'
                    : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
                }`}
              >
                <Icon size={11} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
        </div>
      }
      className="shrink-0"
      bodyClassName="px-3 pb-2.5 pt-1.5"
    >
      <div className="flex items-start gap-3">
        {/* plate entry */}
        <div className="w-[392px] shrink-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
              {mode === 'vehicle' ? 'Target plate / vehicle' : mode === 'camera' ? 'Camera / location' : 'Person / event'}
            </span>
            <span className="text-[8.5px] text-[#55668a]">{activeMode.hint}</span>
          </div>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-cyan"
                strokeWidth={2.2}
              />
              <input
                value={mode === 'vehicle' ? plate : query}
                onChange={(event) => (mode === 'vehicle' ? onPlate(event.target.value) : onQuery(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearch();
                }}
                spellCheck={false}
                aria-label="Investigation search value"
                placeholder={
                  mode === 'vehicle' ? 'GJ01AB1234' : mode === 'camera' ? 'C-038 · Gift City Road' : 'Arjun Rathod / Watchlist Match'
                }
                className={`h-[42px] w-full rounded-[6px] border bg-[#0c1424] pl-9 pr-8 outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow ${
                  mode === 'vehicle'
                    ? 'tnum border-edge-strong font-mono text-[17px] font-bold uppercase tracking-[0.26em] text-white'
                    : 'border-edge text-[12px] text-ink'
                } placeholder:text-[#3f5170]`}
              />
              {(mode === 'vehicle' ? plate : query) ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => (mode === 'vehicle' ? onPlate('') : onQuery(''))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e] transition-colors hover:text-white"
                >
                  <XCircle size={14} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onSearch}
              className="flex h-[42px] w-[104px] shrink-0 flex-col items-center justify-center rounded-[6px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_16px_-4px_rgba(47,125,255,0.9)] transition-all hover:brightness-110"
            >
              {scanning ? (
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
                  Scanning
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {toggle('Fuzzy plate match', fuzzy, onFuzzy, 'Match partial plates and OCR variants')}
            {toggle('Watchlist only', watchlistOnly, onWatchlistOnly, 'Restrict candidates to watchlist entities')}
            {toggle('Include re-reads', includeReReads, onIncludeReReads, 'Show second-frame ANPR re-reads in the sighting history')}
          </div>
        </div>

        <span className="mt-4 h-[74px] w-px shrink-0 bg-edge" />

        {/* candidates */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
              Index candidates
              <span className="tnum ml-1 rounded-[3px] bg-[#16233a] px-1 text-[8px] text-[#8ea1c0]">{candidates.length}</span>
            </span>
            <span className="text-[8.5px] text-[#55668a]">click a candidate to load its dossier</span>
          </div>

          {candidates.length === 0 ? (
            <div className="grid h-[74px] place-items-center rounded-[5px] border border-dashed border-edge text-[10px] text-ink-dim">
              No index match for “{mode === 'vehicle' ? plate : query}” — widen the range or clear the watchlist filter.
            </div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {candidates.map((candidate) => {
                const Icon = candidate.icon;
                const active = candidate.targetId === activePlate && candidate.kind === 'vehicle';
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onSelect(candidate)}
                    className={`group flex w-[196px] shrink-0 items-start gap-2 rounded-[5px] border px-2 py-1.5 text-left transition-all ${
                      active
                        ? 'border-accent-cyan/70 bg-[#083344]/50 shadow-glow'
                        : 'border-edge bg-[#0c1424] hover:border-edge-strong hover:bg-panel-hover'
                    }`}
                  >
                    <span
                      className={`mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[4px] border ${toneRing[candidate.tone]}`}
                    >
                      <Icon size={12} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="tnum flex items-center gap-1 truncate font-mono text-[11px] font-bold tracking-[0.05em] text-white">
                        {candidate.label}
                        {candidate.kind === 'camera' ? <CameraIcon size={9} className="shrink-0 text-[#6d7f9e]" /> : null}
                        {candidate.kind === 'person' ? <ShieldAlert size={9} className="shrink-0 text-[#6d7f9e]" /> : null}
                      </span>
                      <span className="block truncate text-[8.5px] text-[#94a5c2]">{candidate.sub}</span>
                      <span className="mt-[3px] flex items-center gap-1">
                        <span className="truncate text-[8px] text-[#6d82a3]">{candidate.meta}</span>
                        <ArrowRight
                          size={10}
                          className="ml-auto shrink-0 text-[#3f5170] transition-colors group-hover:text-accent-cyan"
                        />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="mt-4 h-[74px] w-px shrink-0 bg-edge" />

        {/* recent investigations */}
        <div className="w-[248px] shrink-0">
          <div className="mb-1 flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
            <History size={10} />
            Recent investigations
          </div>
          <div className="flex flex-col gap-1">
            {recents.map((recent) => (
              <button
                key={recent.id}
                type="button"
                onClick={() => onRecent(recent)}
                className={`flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[3px] text-left transition-colors ${
                  recent.targetId === activePlate
                    ? 'border-accent-blue/50 bg-[#12233f]'
                    : 'border-transparent bg-[#0c1424] hover:border-edge hover:bg-panel-hover'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[recent.tone]}`} />
                <span className="tnum shrink-0 font-mono text-[9.5px] font-semibold text-[#dbe6f5]">{recent.label}</span>
                <span className="min-w-0 flex-1 truncate text-[8px] text-[#7f93b3]">
                  <span className="tnum text-[#55668a]">{recent.id}</span> {recent.sub}
                </span>
                <span className="tnum shrink-0 text-[8px] text-[#55668a]">{recent.ago}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
