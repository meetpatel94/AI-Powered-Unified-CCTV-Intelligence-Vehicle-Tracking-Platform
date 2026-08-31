import { MoreHorizontal } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { watchlistCategories } from '@/data/watchlistData';
import type { CategoryTone } from '@/types/watchlist';

const toneIcon: Record<CategoryTone, string> = {
  red: 'bg-accent-red/10 text-accent-red ring-accent-red/35',
  orange: 'bg-accent-orange/10 text-accent-orange ring-accent-orange/35',
  purple: 'bg-accent-purple/10 text-accent-purple ring-accent-purple/35',
  blue: 'bg-accent-blue/10 text-accent-blue ring-accent-blue/35',
  green: 'bg-accent-green/10 text-accent-green ring-accent-green/35',
  cyan: 'bg-accent-cyan/10 text-accent-cyan ring-accent-cyan/35',
};

const typeLabel: Record<string, string> = { vehicle: 'Vehicle', person: 'Person', other: 'Mixed' };

interface WatchlistCategoriesPanelProps {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

/** Left column: dense category table; clicking a row filters the entry grid. */
export function WatchlistCategoriesPanel({
  activeCategory,
  onSelectCategory,
}: WatchlistCategoriesPanelProps) {
  return (
    <Panel
      title="Watchlist Categories"
      action={
        <span className="tnum text-3xs text-ink-dim">
          {watchlistCategories.length} lists · 248 entries
        </span>
      }
      className="min-h-0"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-1.5"
    >
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_42px_40px_56px_20px] gap-1 px-1.5 pb-1 pt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">
        <span>Category</span>
        <span className="text-right">Entries</span>
        <span className="text-right">Alerts</span>
        <span className="text-right">Updated</span>
        <span />
      </div>

      <div className="flex flex-1 flex-col gap-[3px]">
        {watchlistCategories.map((category) => {
          const active = activeCategory === category.id;
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(active ? 'all' : category.id)}
              className={`grid grid-cols-[minmax(0,1fr)_42px_40px_56px_20px] items-center gap-1 rounded-[5px] border px-1.5 py-[6px] text-left transition-colors ${
                active
                  ? 'border-accent-blue/60 bg-accent-blue/10'
                  : 'border-transparent hover:border-edge hover:bg-panel-hover'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[4px] ring-1 ${toneIcon[category.tone]}`}>
                  <Icon size={11} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[10.5px] font-semibold leading-[13px] ${active ? 'text-white' : 'text-[#dbe6f5]'}`}>
                    {category.name}
                  </span>
                  <span className="block text-[8.5px] leading-[10px] text-[#6d7f9e]">
                    {typeLabel[category.type]} watchlist
                  </span>
                </span>
              </span>

              <span className="tnum text-right text-[10.5px] font-semibold text-[#c3cfe2]">
                {category.entries}
              </span>
              <span className="text-right">
                {category.activeAlerts > 0 ? (
                  <span className="tnum inline-block rounded-[3px] bg-accent-red/15 px-1 py-px text-[9px] font-bold text-[#ff8b96] ring-1 ring-accent-red/35">
                    {category.activeAlerts}
                  </span>
                ) : (
                  <span className="tnum text-[9px] text-[#5c6b87]">0</span>
                )}
              </span>
              <span className="tnum truncate text-right text-[9px] text-[#8ea1c0]">{category.updated}</span>

              <span
                role="presentation"
                className="grid h-[18px] w-[18px] place-items-center rounded-[3px] text-[#6d7f9e] hover:bg-[#1a2942] hover:text-white"
              >
                <MoreHorizontal size={12} />
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
