import {
  BellRing,
  Camera,
  Car,
  History,
  MapPin,
  Pencil,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import { categoryOf } from '@/data/watchlistData';
import type { WatchlistEntry } from '@/types/watchlist';

const statusChip: Record<WatchlistEntry['status'], string> = {
  active: 'text-[#6fe0b0] bg-accent-green/10 ring-accent-green/40',
  monitoring: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40',
  inactive: 'text-[#8ea1c0] bg-[#16233a] ring-edge-strong',
};

const priorityChip: Record<WatchlistEntry['priority'], string> = {
  critical: 'text-[#ff8b96] bg-accent-red/10 ring-accent-red/40',
  high: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40',
  medium: 'text-[#eddb6a] bg-accent-yellow/10 ring-accent-yellow/40',
  low: 'text-[#8ea1c0] bg-[#16233a] ring-edge-strong',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">{label}</div>
      <div className="mt-[2px] truncate text-[10.5px] font-medium text-[#dbe6f5]">{value}</div>
    </div>
  );
}

interface EntryDrawerProps {
  entry: WatchlistEntry | null;
  onClose: () => void;
}

/** Slide-over dossier for a single watchlist entry. */
export function EntryDrawer({ entry, onClose }: EntryDrawerProps) {
  if (!entry) return null;

  const category = categoryOf(entry);
  const TypeIcon = entry.type === 'person' ? UserRound : Car;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[430px] flex-col border-l border-edge bg-[#0a1120] shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-blue/40 bg-accent-blue/15">
              <TypeIcon size={13} className="text-accent-blue" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-bold tracking-wide text-white">{entry.label}</div>
              <div className="text-[9px] text-ink-dim">
                Watchlist entry · {category?.name ?? 'Unassigned'}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {/* hero image */}
          <div className="relative h-[168px] overflow-hidden rounded-md border border-edge bg-[#0c1424]">
            {entry.thumbnail ? (
              <img src={entry.thumbnail} alt={entry.label} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center">
                <TypeIcon size={40} strokeWidth={1.4} className="text-[#3d5078]" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#05070f]/95 to-transparent" />
            <span className="absolute left-2 top-2 rounded-[3px] bg-[#210e30]/90 px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-[#d0a4f7] ring-1 ring-accent-purple/50">
              {category?.name ?? 'Unassigned'}
            </span>
            <span className={`absolute right-2 top-2 rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide ring-1 ${statusChip[entry.status]}`}>
              {entry.status}
            </span>
            {entry.latestMatch ? (
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[9px] text-[#c3cfe2]">
                <span className="flex items-center gap-1">
                  <MapPin size={9} className="text-accent-cyan" />
                  {entry.latestMatch.location}
                </span>
                <span className="tnum">{entry.latestMatch.time}</span>
              </div>
            ) : null}
          </div>

          {/* identity */}
          <section className="mt-3">
            <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Identity</h3>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-edge bg-[#0c1424] px-3 py-2.5">
              <Field label="Type" value={entry.type === 'vehicle' ? 'Vehicle' : entry.type === 'person' ? 'Person' : 'Other entity'} />
              <Field label={entry.type === 'vehicle' ? 'Plate Number' : 'Full Name'} value={entry.label} />
              {entry.alias ? <Field label="Alias" value={entry.alias} /> : <Field label="Added By" value={entry.addedBy} />}
              <Field label="Details" value={entry.details} />
              <Field label="Category" value={category?.name ?? '—'} />
              <div className="min-w-0">
                <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">Status</div>
                <span className={`mt-[2px] inline-block rounded-[3px] px-1.5 py-px text-[9px] font-bold uppercase ring-1 ${statusChip[entry.status]}`}>
                  {entry.status}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">Priority</div>
                <span className={`mt-[2px] inline-block rounded-[3px] px-1.5 py-px text-[9px] font-bold uppercase ring-1 ${priorityChip[entry.priority]}`}>
                  {entry.priority}
                </span>
              </div>
              <Field label="Added On" value={`${entry.addedOn} · ${entry.addedBy}`} />
            </div>
          </section>

          {/* notes */}
          <section className="mt-3">
            <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Notes</h3>
            <p className="mt-1.5 rounded-md border border-edge bg-[#0c1424] px-3 py-2 text-[10px] leading-[15px] text-[#b9c7dd]">
              {entry.notes}
            </p>
          </section>

          {/* matching cameras */}
          <section className="mt-3">
            <h3 className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
              <Camera size={10} className="text-accent-cyan" />
              Matching Cameras
              <span className="tnum rounded-full bg-[#16233a] px-1.5 text-[8.5px] text-[#8ea1c0]">
                {entry.matchingCameras.length}
              </span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.matchingCameras.map((camera) => (
                <span
                  key={camera}
                  className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-2 py-[3px] text-[9.5px] font-semibold text-[#9fc7ff]"
                >
                  {camera}
                </span>
              ))}
            </div>
          </section>

          {/* latest match */}
          {entry.latestMatch ? (
            <section className="mt-3">
              <h3 className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
                <BellRing size={10} className="text-accent-red" />
                Latest Match
              </h3>
              <div className="mt-1.5 rounded-md border border-accent-red/35 bg-[#2a0d13] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-[#ff8b96]">{entry.latestMatch.camera} · {entry.latestMatch.location}</span>
                  <span className="tnum text-[9px] text-ink-dim">{entry.latestMatch.ago}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9.5px] text-[#e3b6bc]">
                  <span className="tnum">{entry.latestMatch.time}</span>
                  <span className="tnum font-bold text-white">{entry.latestMatch.confidence}% confidence</span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#4a1620]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-red to-accent-orange"
                    style={{ width: `${entry.latestMatch.confidence}%` }}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {/* history */}
          <section className="mt-3 pb-1">
            <h3 className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
              <History size={10} className="text-accent-blue" />
              Match History
              <span className="tnum rounded-full bg-[#16233a] px-1.5 text-[8.5px] text-[#8ea1c0]">{entry.matches} total</span>
            </h3>
            <ol className="mt-1.5 space-y-0">
              {entry.history.map((event, index) => (
                <li key={`${event.camera}-${event.time}`} className="relative flex gap-2.5 pb-2.5">
                  {index < entry.history.length - 1 ? (
                    <span className="absolute left-[5px] top-[14px] bottom-0 w-px bg-edge" />
                  ) : null}
                  <span className={`mt-[3px] h-[11px] w-[11px] shrink-0 rounded-full ring-2 ${index === 0 ? 'bg-accent-red ring-accent-red/30' : 'bg-[#1d3a5c] ring-edge'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-semibold text-[#dbe6f5]">
                        {event.camera} · {event.location}
                      </span>
                      <span className="tnum shrink-0 text-[8.5px] text-[#6d7f9e]">{event.ago}</span>
                    </div>
                    <div className="tnum text-[9px] text-[#8ea1c0]">
                      {event.time} · {event.confidence}% confidence
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* footer actions */}
        <footer className="flex shrink-0 items-center gap-2 border-t border-edge px-3.5 py-2.5">
          <button
            type="button"
            className="flex h-[28px] flex-1 items-center justify-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-[10px] font-semibold text-white transition-all hover:brightness-110"
          >
            <Camera size={11} />
            View on Camera Map
          </button>
          <button
            type="button"
            className="flex h-[28px] flex-1 items-center justify-center gap-1.5 rounded-[5px] border border-edge bg-panel text-[10px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            <Pencil size={11} />
            Edit Entry
          </button>
          <button
            type="button"
            className="grid h-[28px] w-[28px] place-items-center rounded-[5px] border border-edge bg-panel text-[#8ea3c4] transition-colors hover:border-accent-green/50 hover:text-accent-green"
            title="Mark verified"
          >
            <ShieldCheck size={13} />
          </button>
        </footer>
      </aside>
    </div>
  );
}
