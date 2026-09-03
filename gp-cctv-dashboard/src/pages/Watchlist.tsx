import { BellRing, Car, CarFront, Gauge, Layers, Package, ShieldAlert, Siren, UserRound, UserSearch, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
import { mapWatchlistEntry, useWatchlistAlerts, useWatchlistConsole } from '@/hooks/useIntelligence';
import type { WatchlistEntry } from '@/types/watchlist';

/**
 * WATCHLIST MANAGEMENT screen: KPI strip, filter bar, three-column body
 * (categories / entries / alerts+summary) and the analytics bottom row.
 * Entries stream from `/api/watchlist` (WS `watchlist:match` refresh); CRUD
 * POSTs/PATCHes the backend with local optimistic fallback offline.
 */
export function Watchlist() {
  const intel = useWatchlistConsole();
  const wlAlerts = useWatchlistAlerts(200);
  const [entries, setEntries] = useState<WatchlistEntry[]>(watchlistEntries);
  const [liveMode, setLiveMode] = useState(false);

  // Adopt backend entries whenever the console pulls a fresh page.
  useEffect(() => {
    if (intel.live && intel.entries) {
      setLiveMode(true);
      setEntries(intel.entries);
    }
  }, [intel.entries, intel.live]);
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
    // Persist to the backend when reachable; local-only otherwise.
    void intel
      .create({
        plate: input.type === 'vehicle' ? input.label : null,
        entry_type: input.type,
        label: input.label,
        alias: input.alias ?? null,
        details: input.details,
        category: input.categoryId,
        priority: input.priority,
      })
      .then((dto) => {
        setEntries((prev) => [mapWatchlistEntry(dto), ...prev.filter((e) => e.id !== String(dto.id))]);
      })
      .catch(() => undefined);

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

  /* ---- live-derived panel data (mock fallbacks below) ---- */
  const liveCategories = useMemo(() => {
    if (!liveMode || !intel.stats) return undefined;
    const barsByCategory = new Map<string, number>();
    (wlAlerts ?? []).forEach((alert) => {
      if (alert.category) barsByCategory.set(alert.category, (barsByCategory.get(alert.category) ?? 0) + 1);
    });
    const meta: Record<string, { name: string; tone: 'red' | 'orange' | 'purple' | 'blue' | 'green' | 'cyan'; icon: typeof ShieldAlert }> = {
      stolen: { name: 'Stolen Vehicles', tone: 'orange', icon: Car },
      wanted: { name: 'Wanted Persons', tone: 'purple', icon: UserSearch },
      suspect: { name: 'Suspect Vehicles', tone: 'blue', icon: CarFront },
      missing: { name: 'Missing Persons', tone: 'cyan', icon: UserRound },
      traffic: { name: 'Traffic Violators', tone: 'green', icon: Gauge },
      security: { name: 'Security / Sensitive', tone: 'red', icon: Siren },
      others: { name: 'Others', tone: 'cyan', icon: Package },
    };
    return Object.entries(intel.stats.by_category)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        name: meta[id]?.name ?? id.replaceAll('_', ' '),
        type: id === 'wanted' || id === 'missing' ? ('person' as const) : ('vehicle' as const),
        entries: count,
        activeAlerts: barsByCategory.get(id) ?? 0,
        updated: 'live',
        tone: meta[id]?.tone ?? ('cyan' as const),
        icon: meta[id]?.icon ?? Package,
      }));
  }, [liveMode, intel.stats, wlAlerts]);

  const kpis = useMemo(() => {
    if (!liveMode || !intel.stats) return undefined;
    const vehicles = entries.filter((entry) => entry.type === 'vehicle').length;
    const persons = entries.filter((entry) => entry.type === 'person').length;
    const others = Math.max(0, entries.length - vehicles - persons);
    const activeAlerts = (wlAlerts ?? []).filter((alert) => alert.severity === 'critical' || alert.severity === 'high').length;
    return [
      {
        id: 'total',
        label: 'Total Watchlist Entries',
        value: String(intel.stats.total_entries),
        footnote: `${intel.stats.active_entries} active · ${intel.stats.matches} matches (7d)`,
        tone: 'blue' as const,
        icon: Layers,
      },
      {
        id: 'alerts',
        label: 'Watchlist Alerts',
        value: String((wlAlerts ?? []).length),
        footnote: `${activeAlerts} high/critical need review`,
        tone: 'red' as const,
        icon: BellRing,
      },
      {
        id: 'vehicles',
        label: 'Vehicles',
        value: String(vehicles),
        footnote: intel.stats.total_entries > 0 ? `${Math.round((vehicles / intel.stats.total_entries) * 100)}% of all entries` : '—',
        tone: 'green' as const,
        icon: CarFront,
      },
      {
        id: 'persons',
        label: 'Persons',
        value: String(persons),
        footnote: intel.stats.total_entries > 0 ? `${Math.round((persons / intel.stats.total_entries) * 100)}% of all entries` : '—',
        tone: 'purple' as const,
        icon: UsersRound,
      },
      {
        id: 'other',
        label: 'Other Entities',
        value: String(others),
        footnote: intel.stats.total_entries > 0 ? `${Math.round((others / Math.max(1, intel.stats.total_entries)) * 100)}% of all entries` : '—',
        tone: 'orange' as const,
        icon: Package,
      },
    ];
  }, [liveMode, intel.stats, entries, wlAlerts]);

  const summarySlices = useMemo(() => {
    if (!liveMode) return undefined;
    const vehicles = entries.filter((entry) => entry.type === 'vehicle').length;
    const persons = entries.filter((entry) => entry.type === 'person').length;
    const others = Math.max(0, entries.length - vehicles - persons);
    const total = Math.max(1, vehicles + persons + others);
    return [
      { id: 'vehicles', label: 'Vehicles', count: vehicles, percent: Math.round((vehicles / total) * 100), color: '#2f7dff' },
      { id: 'persons', label: 'Persons', count: persons, percent: Math.round((persons / total) * 100), color: '#a855f7' },
      { id: 'others', label: 'Others', count: others, percent: Math.round((others / total) * 100), color: '#22d3ee' },
    ].filter((slice) => slice.count > 0);
  }, [liveMode, entries]);

  const liveBars = useMemo(() => {
    if (!liveMode) return undefined;
    const counts = new Map<string, number>();
    (wlAlerts ?? []).forEach((alert) => {
      const key = alert.category ?? 'others';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const palette: Record<string, string> = {
      stolen: '#f59e0b',
      wanted: '#a855f7',
      suspect: '#2f7dff',
      missing: '#22d3ee',
      traffic: '#22c55e',
      security: '#ef4444',
      others: '#22d3ee',
    };
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
    return rows.map(([id, value]) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1, 7),
      value,
      color: palette[id] ?? '#2f7dff',
    }));
  }, [liveMode, wlAlerts]);

  const liveMatches = useMemo(() => {
    if (!liveMode || !intel.stats) return undefined;
    return intel.stats.matches_timeseries.map((point) => ({ day: point.day.slice(8), value: point.matches }));
  }, [liveMode, intel.stats]);

  const liveTopLocations = useMemo(() => {
    if (!liveMode || !intel.stats) return undefined;
    return intel.stats.top_match_locations.slice(0, 8).map((row, index) => {
      const [name, city = 'Gujarat'] = (row.location_name ?? row.camera_id).split(',').map((part) => part.trim());
      return {
        id: `top-${index}`,
        rank: index + 1,
        name,
        city,
        matches: row.matches,
        trend: 'flat' as const,
      };
    });
  }, [liveMode, intel.stats]);

  const railAlerts = liveMode ? (wlAlerts ?? []).slice(0, 6) : undefined;

  return (
    <div className="page">
      <WatchlistHeader
        filtersVisible={filtersVisible}
        onToggleFilters={() => setFiltersVisible((value) => !value)}
        onAdd={() => setAddOpen(true)}
        onExport={handleExport}
        onImportFile={handleImportFile}
      />

      <WatchlistKpiRow kpis={kpis} />

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
          categories={liveCategories}
        />
      ) : null}

      {/* row 1 — Watchlist Categories (left) + Alert History (right) */}
      <div className="responsive-band grid shrink-0 grid-cols-1 gap-[var(--page-gap)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <WatchlistCategoriesPanel
            activeCategory={categoryFilter}
            onSelectCategory={setCategoryFilter}
            categories={liveCategories}
          />
        </div>

        <div className="min-w-0">
          <WatchlistAlertsPanel alerts={railAlerts} />
        </div>
      </div>

      {/* row 2 — Recent Watchlist Entries, full width */}
      <div className="responsive-band grid w-full min-w-0 shrink-0 grid-cols-1 gap-[var(--page-gap)]">
        <div className="min-w-0">
          <RecentEntriesPanel entries={visibleEntries} total={entries.length} view={view} onOpen={setSelected} />
        </div>
      </div>

      {/* row 3 — Watchlist Summary */}
      <div className="responsive-band grid w-full min-w-0 shrink-0 grid-cols-1 gap-[var(--page-gap)]">
        <div className="min-w-0">
          <WatchlistSummaryPanel slices={summarySlices} />
        </div>
      </div>

      {/* analytics bottom row */}
      <div
        className="responsive-band responsive-band-chart grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-[33fr_40fr_27fr]"
      >
        <div className="min-w-0">
          <AlertsByWatchlistPanel bars={liveBars} windowLabel={liveBars ? `last 24 hrs · ${liveBars.reduce((sum, bar) => sum + bar.value, 0)} total` : undefined} />
        </div>
        <div className="min-w-0">
          <MatchesOverTimePanel series={liveMatches} />
        </div>
        <div className="min-w-0">
          <TopLocationsPanel locations={liveTopLocations} windowLabel={liveTopLocations ? 'last 7 days' : undefined} />
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
