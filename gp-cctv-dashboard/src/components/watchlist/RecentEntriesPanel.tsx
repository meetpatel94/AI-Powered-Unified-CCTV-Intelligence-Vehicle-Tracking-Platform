import { CalendarDays, Car, Eye, LocateFixed, MoreHorizontal, Pencil, UserRound } from 'lucide-react';

import { categoryOf } from '@/data/watchlistData';
import type { CategoryTone, WatchlistEntry } from '@/types/watchlist';

import type { EntryViewMode } from './WatchlistFilterBar';

const badgeTone: Record<CategoryTone, string> = {
  red: 'bg-[#3d0f16]/90 text-[#ff8b96] ring-accent-red/50',
  orange: 'bg-[#2a1a08]/90 text-[#f7b95f] ring-accent-orange/50',
  purple: 'bg-[#210e30]/90 text-[#d0a4f7] ring-accent-purple/50',
  blue: 'bg-[#0b1f3d]/90 text-[#7db4ff] ring-accent-blue/50',
  green: 'bg-[#0a2119]/90 text-[#6fe0b0] ring-accent-green/50',
  cyan: 'bg-[#083344]/90 text-[#67e8f9] ring-accent-cyan/50',
};

const statusTone: Record<WatchlistEntry['status'], { chip: string; dot: string; label: string }> = {
  active: { chip: 'text-[#6fe0b0] bg-accent-green/10 ring-accent-green/40', dot: 'bg-accent-green', label: 'Active' },
  monitoring: { chip: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40', dot: 'bg-accent-orange', label: 'Monitoring' },
  inactive: { chip: 'text-[#8ea1c0] bg-[#16233a] ring-edge-strong', dot: 'bg-[#6d7f9e]', label: 'Inactive' },
};

function TypePlaceholder({ type }: { type: WatchlistEntry['type'] }) {
  const Icon = type === 'person' ? UserRound : Car;
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#101a2e] to-[#0a1120]">
      <Icon size={26} strokeWidth={1.5} className="text-[#3d5078]" />
    </div>
  );
}

interface RecentEntriesPanelProps {
  entries: WatchlistEntry[];
  total: number;
  view: EntryViewMode;
  onOpen: (entry: WatchlistEntry) => void;
}

/** Center column: dense card grid (or list) of recent watchlist entries. */
export function RecentEntriesPanel({ entries, total, view, onOpen }: RecentEntriesPanelProps) {
  return (
    <section className="panel flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2.5">
        <h2 className="panel-title">
          Recent Watchlist Entries
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-dim">
            showing {entries.length} of {total}
          </span>
        </h2>
        <span className="flex items-center gap-2 text-3xs text-ink-dim">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" /> auto-sync on
          </span>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
        {entries.length === 0 ? (
          <div className="grid h-full place-items-center text-[11px] text-ink-dim">
            No watchlist entries match the current filters.
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
            <div className="grid grid-cols-[150px_minmax(0,1fr)_120px_86px_110px_64px_54px] gap-2 px-1.5 pb-1 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">
              <span>Entity</span>
              <span>Details</span>
              <span>Category</span>
              <span>Status</span>
              <span>Last Match</span>
              <span className="text-right">Matches</span>
              <span />
            </div>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EntryCard({ entry, onOpen }: { entry: WatchlistEntry; onOpen: (e: WatchlistEntry) => void }) {
  const category = categoryOf(entry);
  const status = statusTone[entry.status];
  const tone = category ? badgeTone[category.tone] : badgeTone.blue;

  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-md border border-edge bg-[#0c1424] transition-colors hover:border-accent-blue/60 hover:shadow-glow"
      onClick={() => onOpen(entry)}
    >
      {/* thumbnail */}
      <div className="relative h-[96px] w-full overflow-hidden border-b border-edge-soft bg-[#0a1120]">
        {entry.thumbnail ? (
          <img src={entry.thumbnail} alt={entry.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <TypePlaceholder type={entry.type} />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#05070f]/90 to-transparent" />
        <span className={`absolute left-1.5 top-1.5 rounded-[3px] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
          {category?.name ?? 'Unassigned'}
        </span>
        <span className={`absolute right-1.5 top-1.5 flex items-center gap-1 rounded-[3px] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide ring-1 ${status.chip}`}>
          <span className={`h-1 w-1 rounded-full ${status.dot} animate-pulse-dot`} />
          {status.label}
        </span>
        {entry.latestMatch ? (
          <span className="tnum absolute bottom-1 left-1.5 flex items-center gap-1 text-[8.5px] text-[#9fb0cc]">
            <LocateFixed size={9} className="text-accent-cyan" />
            {entry.latestMatch.camera} · {entry.latestMatch.ago}
          </span>
        ) : null}
      </div>

      {/* body */}
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11.5px] font-bold tracking-wide text-white">{entry.label}</span>
          <span className="tnum shrink-0 rounded-[3px] bg-[#16233a] px-1 py-px text-[8.5px] font-semibold text-[#9fb0cc]">
            {entry.matches} matches
          </span>
        </div>
        {entry.alias ? (
          <div className="truncate text-[9px] text-[#8ea1c0]">alias “{entry.alias}”</div>
        ) : null}
        <div className="mt-[1px] truncate text-[9.5px] text-[#94a5c2]">{entry.details}</div>
        <div className="mt-1.5 flex items-center justify-between border-t border-edge-soft pt-1.5">
          <span className="tnum flex items-center gap-1 text-[8.5px] text-[#6d7f9e]">
            <CalendarDays size={9} />
            Added {entry.addedOn}
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              title="Open details"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(entry);
              }}
              className="grid h-[18px] w-[18px] place-items-center rounded-[3px] text-[#8ea3c4] transition-colors hover:bg-accent-blue/20 hover:text-white"
            >
              <Eye size={11} />
            </button>
            <button
              type="button"
              title="Edit entry"
              className="grid h-[18px] w-[18px] place-items-center rounded-[3px] text-[#8ea3c4] transition-colors hover:bg-accent-blue/20 hover:text-white"
            >
              <Pencil size={10} />
            </button>
            <button
              type="button"
              title="More"
              className="grid h-[18px] w-[18px] place-items-center rounded-[3px] text-[#8ea3c4] transition-colors hover:bg-accent-blue/20 hover:text-white"
            >
              <MoreHorizontal size={11} />
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

function EntryRow({ entry, onOpen }: { entry: WatchlistEntry; onOpen: (e: WatchlistEntry) => void }) {
  const category = categoryOf(entry);
  const status = statusTone[entry.status];
  const tone = category ? badgeTone[category.tone] : badgeTone.blue;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="grid grid-cols-[150px_minmax(0,1fr)_120px_86px_110px_64px_54px] items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[5px] text-left transition-colors hover:border-edge hover:bg-panel-hover"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-[26px] w-[38px] shrink-0 overflow-hidden rounded-[3px] border border-edge-soft bg-[#0a1120]">
          {entry.thumbnail ? (
            <img src={entry.thumbnail} alt={entry.label} className="h-full w-full object-cover" />
          ) : (
            <TypePlaceholder type={entry.type} />
          )}
        </span>
        <span className="truncate text-[10.5px] font-bold tracking-wide text-white">{entry.label}</span>
      </span>
      <span className="truncate text-[9.5px] text-[#94a5c2]">
        {entry.details}
        {entry.alias ? ` · alias “${entry.alias}”` : ''}
      </span>
      <span className={`truncate rounded-[3px] px-1.5 py-px text-center text-[8px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
        {category?.name ?? '—'}
      </span>
      <span className={`flex items-center gap-1 rounded-[3px] px-1.5 py-px text-[8px] font-bold uppercase ring-1 ${status.chip}`}>
        <span className={`h-1 w-1 rounded-full ${status.dot}`} />
        {status.label}
      </span>
      <span className="tnum truncate text-[9px] text-[#8ea1c0]">
        {entry.latestMatch ? `${entry.latestMatch.ago} · ${entry.latestMatch.camera}` : 'No matches yet'}
      </span>
      <span className="tnum text-right text-[10px] font-semibold text-[#c3cfe2]">{entry.matches}</span>
      <span className="grid h-[18px] w-[18px] place-items-center justify-self-end rounded-[3px] text-[#8ea3c4] hover:bg-accent-blue/20 hover:text-white">
        <Eye size={11} />
      </span>
    </button>
  );
}
