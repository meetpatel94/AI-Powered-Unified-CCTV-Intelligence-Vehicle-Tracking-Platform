import { useMemo, useRef, useState } from 'react';

import { AddWatchlistModal, type NewWatchlistInput } from '@/components/watchlist/AddWatchlistModal';
import { EntryDrawer } from '@/components/watchlist/EntryDrawer';
import { AlertsByWatchlistPanel } from '@/components/watchlist/AlertsByWatchlistPanel';
import { MatchesOverTimePanel } from '@/components/watchlist/MatchesOverTimePanel';
import { RecentEntriesPanel } from '@/components/watchlist/RecentEntriesPanel';
import { TopLocationsPanel } from '@/components/watchlist/TopLocationsPanel';
import { WatchlistAlertsPanel } from '@/components/watchlist/WatchlistAlertsPanel';
import { WatchlistCategoriesPanel } from '@/components/watchlist/WatchlistCategoriesPanel';
import { WatchlistFilterBar, type EntrySortMode, type EntryViewMode } from '@/components/watchlist/WatchlistFilterBar';
import { WatchlistHeader } from '@/components/watchlist/WatchlistHeader';
import { WatchlistKpiRow } from '@/components/watchlist/WatchlistKpiRow';
import { WatchlistSummaryPanel } from '@/components/watchlist/WatchlistSummaryPanel';
import { watchlistEntries } from '@/data/watchlistData';
import type { WatchlistEntry } from '@/types/watchlist';

/**
 * WATCHLIST MANAGEMENT screen: KPI strip, filter bar, three-column body
 * (categories / entries / alerts+summary) and the analytics bottom row.
 */
export function Watchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>(watchlistEntries);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<EntrySortMode>('lastmatch');
  const [view, setView] = useState<EntryViewMode>('grid');
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [selected, setSelected] = useState<WatchlistEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const flash = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  };

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((entry) => {
      if (categoryFilter !== 'all' && entry.categoryId !== categoryFilter) return false;
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (!q) return true;
      return (
        entry.label.toLowerCase().includes(q) ||
        (entry.alias ?? '').toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      );
    });

    switch (sort) {
      case 'matches':
        return [...list].sort((a, b) => b.matches - a.matches);
      case 'lastmatch':
        return [...list].sort((a, b) => b.lastMatchTs - a.lastMatchTs);
      case 'name':
        return [...list].sort((a, b) => a.label.localeCompare(b.label));
      default:
        return [...list].sort((a, b) => b.addedTs - a.addedTs);
    }
  }, [entries, categoryFilter, typeFilter, query, sort]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gp-watchlist-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${entries.length} watchlist entries`);
  };

  const handleImportFile = (file: File) => {
    file
      .text()
      .then((text) => {
        const parsed: unknown = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : [];
        const imported: WatchlistEntry[] = rows
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map((row, index) => ({
            id: `wl-import-${Date.now()}-${index}`,
            type: row.type === 'person' ? 'person' : row.type === 'other' ? 'other' : 'vehicle',
            label: String(row.label ?? row.plate ?? 'UNKNOWN'),
            alias: typeof row.alias === 'string' ? row.alias : undefined,
            details: typeof row.details === 'string' ? row.details : 'Imported entry — details pending',
            categoryId: typeof row.categoryId === 'string' ? row.categoryId : 'others',
            status: 'active',
            priority: 'medium',
            addedOn: '31 Aug 2026',
            addedTs: 20260831,
            lastMatchTs: 0,
            addedBy: 'Import',
            matches: 0,
            notes: 'Imported via JSON. Verify against case file within 24 hrs.',
            matchingCameras: [],
            history: [],
          }));

        if (imported.length === 0) {
          flash('Import failed: no valid entries in file');
          return;
        }
        setEntries((prev) => [...imported, ...prev]);
        flash(`Imported ${imported.length} entries`);
      })
      .catch(() => flash('Import failed: invalid JSON file'));
  };

  const handleCreate = (input: NewWatchlistInput) => {
    const entry: WatchlistEntry = {
      id: `wl-${Date.now()}`,
      type: input.type,
      label: input.label,
      alias: input.alias,
      details: input.details,
      categoryId: input.categoryId,
      status: input.status,
      priority: input.priority,
      addedOn: '31 Aug 2026',
      addedTs: 20260831,
      lastMatchTs: 0,
      addedBy: 'Insp. Rajveer',
      matches: 0,
      notes: input.notes,
      matchingCameras: [],
      history: [],
    };
    setEntries((prev) => [entry, ...prev]);
    setAddOpen(false);
    flash(`${entry.label} added to watchlist`);
  };

  return (
    <div className="page">
      <WatchlistHeader
        filtersVisible={filtersVisible}
        onToggleFilters={() => setFiltersVisible((value) => !value)}
        onAdd={() => setAddOpen(true)}
        onExport={handleExport}
        onImportFile={handleImportFile}
      />

      <WatchlistKpiRow />

      {filtersVisible ? (
        <WatchlistFilterBar
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          view={view}
          onView={setView}
        />
      ) : null}

      {/* three-column body */}
      <div
        className="responsive-band responsive-band-main grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-2 xl:grid-cols-[minmax(290px,26fr)_minmax(0,1fr)_minmax(310px,310px)]"
      >
        <div className="min-w-0">
          <WatchlistCategoriesPanel activeCategory={categoryFilter} onSelectCategory={setCategoryFilter} />
        </div>

        <div className="min-w-0">
          <RecentEntriesPanel entries={visibleEntries} total={entries.length} view={view} onOpen={setSelected} />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-[var(--page-gap)] sm:grid-cols-2 md:col-span-2 xl:flex xl:flex-col xl:col-span-1">
          <div className="min-h-0 min-w-0 xl:flex-1">
            <WatchlistAlertsPanel />
          </div>
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <WatchlistSummaryPanel />
          </div>
        </div>
      </div>

      {/* analytics bottom row */}
      <div
        className="responsive-band responsive-band-chart grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-[33fr_40fr_27fr]"
      >
        <div className="min-w-0">
          <AlertsByWatchlistPanel />
        </div>
        <div className="min-w-0">
          <MatchesOverTimePanel />
        </div>
        <div className="min-w-0">
          <TopLocationsPanel />
        </div>
      </div>

      <EntryDrawer entry={selected} onClose={() => setSelected(null)} />
      <AddWatchlistModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={handleCreate} />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] rounded-[6px] border border-accent-green/50 bg-[#0b2e26] px-3 py-2 text-[12.5px] font-medium text-[#6fe0b0] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
