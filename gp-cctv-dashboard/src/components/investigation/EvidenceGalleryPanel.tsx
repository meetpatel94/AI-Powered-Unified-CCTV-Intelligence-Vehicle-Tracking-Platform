import { Expand, Eye, Images, ScanSearch, ShieldAlert, Video } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { EvidenceItem } from '@/types/investigation';

interface EvidenceGalleryPanelProps {
  evidence: EvidenceItem[];
  totalCount: number;
  filter: string;
  onFilter: (value: string) => void;
  onOpen: (item: EvidenceItem) => void;
  onFullscreen: (item: EvidenceItem) => void;
  cameraOptions: Array<{ id: string; label: string }>;
}

const filters = [
  { id: 'all', label: 'All frames' },
  { id: 'route', label: 'Route nodes' },
  { id: 'watchlist', label: 'Watchlist hits' },
];

/** EVIDENCE GALLERY: archived CCTV frames for the investigation. */
export function EvidenceGalleryPanel({
  evidence,
  totalCount,
  filter,
  onFilter,
  onOpen,
  onFullscreen,
  cameraOptions,
}: EvidenceGalleryPanelProps) {
  return (
    <Panel
      title="Evidence Gallery"
      tools={
        <div className="flex items-center gap-1.5">
          <span className="tnum flex items-center gap-1 text-3xs text-ink-dim">
            <Images size={9} />
            {evidence.length} of {totalCount} frames · 38 s clips retained 90 days
          </span>
          <div className="flex items-center gap-px overflow-hidden rounded-[4px] border border-edge bg-[#0a1120] p-px">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilter(item.id)}
                className={`h-[20px] px-2 text-[11px] font-semibold transition-colors ${
                  filter === item.id ? 'bg-[#1f5fd8] text-white' : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            value={filter.startsWith('cam:') ? filter.slice(4) : 'all'}
            onChange={(event) => onFilter(event.target.value === 'all' ? 'all' : `cam:${event.target.value}`)}
            aria-label="Filter evidence by camera"
            className="h-[22px] rounded-[4px] border border-edge bg-[#0c1424] px-1.5 text-[11px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70"
          >
            <option value="all">All cameras</option>
            {cameraOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      }
      className="h-full min-h-0"
      bodyClassName="px-2 pb-2 pt-0.5"
    >
      <div className="grid h-full min-h-0 grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-1.5 overflow-y-auto">
        {evidence.map((item) => (
          <article
            key={item.id}
            className={`group flex flex-col overflow-hidden rounded-[5px] border bg-[#0c1424] transition-colors hover:bg-panel-hover ${
              item.watchlistHit ? 'border-accent-red/50' : 'border-edge'
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              title="Open the detailed evidence view"
              className="relative block h-[66px] w-full overflow-hidden"
            >
              <img src={item.thumbnail} alt={`${item.cameraId} frame ${item.time}`} className="h-full w-full object-cover" />
              <span className="pointer-events-none absolute inset-x-0 top-0 h-10 animate-sweep bg-gradient-to-b from-accent-cyan/10 via-transparent to-transparent" />
              {item.watchlistHit ? <span className="pointer-events-none absolute inset-0 bg-accent-red/15 ring-1 ring-inset ring-accent-red/50" /> : null}
              <span className="tnum absolute left-1 top-1 rounded-[2px] bg-black/75 px-1 py-px font-mono text-[10px] font-bold text-white">
                {item.cameraId}
              </span>
              <span className="tnum absolute right-1 top-1 rounded-[2px] bg-black/75 px-1 py-px text-[9.5px] text-[#c9d6ea]">
                {item.confidence.toFixed(1)}%
              </span>
              <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-[2px] bg-black/75 px-1 py-px text-[9px] font-semibold uppercase text-[#9fb0cc]">
                <Video size={7} /> {item.clip}
              </span>
              {item.primary ? (
                <span className="absolute bottom-1 right-1 rounded-[2px] bg-[#083344]/90 px-1 py-px text-[9px] font-bold uppercase text-[#67e8f9]">
                  route
                </span>
              ) : null}
              <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex items-center gap-1 rounded-[4px] border border-accent-cyan/60 bg-[#05070f]/85 px-2 py-1 text-[11px] font-semibold text-[#67e8f9]">
                  <Eye size={10} /> View evidence
                </span>
              </span>
            </button>

            <div className="px-1.5 py-1">
              <div className="tnum flex items-center justify-between text-[10.5px]">
                <span className="font-mono font-semibold text-[#dbe6f5]">{item.time}</span>
                <span className="text-[#6d82a3]">{item.city}</span>
              </div>
              <div className="truncate text-[10px] text-[#7f93b3]">{item.location}</div>
              <div className="mt-[3px] flex items-center gap-1">
                <span className="truncate rounded-[2px] bg-[#0d1626] px-1 py-px text-[9px] text-[#8ea1c0] ring-1 ring-edge">
                  {item.tags[0]}
                </span>
                {item.watchlistHit ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-[2px] bg-accent-red/20 px-1 py-px text-[9px] font-bold text-[#ff8b96]">
                    <ShieldAlert size={7} /> WL
                  </span>
                ) : null}
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    title="Open detailed evidence view"
                    className="grid h-[18px] w-[18px] place-items-center rounded-[3px] border border-edge bg-[#0d1626] text-[#8ea3c4] transition-colors hover:border-accent-cyan/60 hover:text-[#67e8f9]"
                  >
                    <ScanSearch size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFullscreen(item)}
                    title="Open fullscreen"
                    className="grid h-[18px] w-[18px] place-items-center rounded-[3px] border border-edge bg-[#0d1626] text-[#8ea3c4] transition-colors hover:border-accent-blue/60 hover:text-white"
                  >
                    <Expand size={10} />
                  </button>
                </span>
              </div>
            </div>
          </article>
        ))}

        {evidence.length === 0 ? (
          <div className="col-span-full grid place-items-center rounded-[5px] border border-dashed border-edge py-6 text-[12px] text-ink-dim">
            No evidence frame matches this filter.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
