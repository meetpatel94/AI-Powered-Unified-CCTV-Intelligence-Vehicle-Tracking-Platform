import { ArrowUpDown, LayoutGrid, List, Search } from 'lucide-react';

import type { WatchlistCategory } from '@/types/watchlist';

export type EntryViewMode = 'grid' | 'list';
export type EntrySortMode = 'recent' | 'matches' | 'lastmatch' | 'name';

interface WatchlistFilterBarProps {
  categoryFilter: string;
  onCategoryFilter: (id: string) => void;
  typeFilter: string;
  onTypeFilter: (id: string) => void;
  query: string;
  onQuery: (value: string) => void;
  sort: EntrySortMode;
  onSort: (value: EntrySortMode) => void;
  view: EntryViewMode;
  onView: (mode: EntryViewMode) => void;
  categories?: WatchlistCategory[];
}

const selectCls =
  'h-[32px] shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[13px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

/** Filter strip: watchlist + type selects, search, sort and grid/list toggle. */
export function WatchlistFilterBar({
  categories = [],
  categoryFilter,
  onCategoryFilter,
  typeFilter,
  onTypeFilter,
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
}: WatchlistFilterBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-edge bg-panel px-2.5 py-2">
      <select value={categoryFilter} onChange={(e) => onCategoryFilter(e.target.value)} className={`${selectCls} w-[150px]`}>
        <option value="all">All Watchlists</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <select value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)} className={`${selectCls} w-[110px]`}>
        <option value="all">All Types</option>
        <option value="vehicle">Vehicle</option>
        <option value="person">Person</option>
        <option value="other">Other</option>
      </select>

      <div className="relative min-w-[220px] flex-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search by Number / Name / Alias..."
          className="h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-8 pr-2 text-[13px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
        />
      </div>

      <div className="relative shrink-0">
        <ArrowUpDown size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as EntrySortMode)}
          className={`${selectCls} w-[150px] pl-6`}
        >
          <option value="recent">Recently Added</option>
          <option value="lastmatch">Last Matched</option>
          <option value="matches">Most Matched</option>
          <option value="name">Number / Name A–Z</option>
        </select>
      </div>

      <div className="flex shrink-0 items-center gap-px overflow-hidden rounded-[4px] border border-edge">
        {(
          [
            { mode: 'grid' as EntryViewMode, icon: LayoutGrid, title: 'Grid view' },
            { mode: 'list' as EntryViewMode, icon: List, title: 'List view' },
          ] as const
        ).map(({ mode, icon: Icon, title }) => (
          <button
            key={mode}
            type="button"
            title={title}
            onClick={() => onView(mode)}
            className={`grid h-[30px] w-[32px] place-items-center transition-colors ${
              view === mode ? 'bg-[#1d6ce0] text-white' : 'bg-[#0c1424] text-[#8ea3c4] hover:text-white'
            }`}
          >
            <Icon size={13} strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  );
}
