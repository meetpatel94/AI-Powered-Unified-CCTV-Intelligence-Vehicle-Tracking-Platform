import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Search, X } from 'lucide-react';

import { useGlobalSearch, type GlobalSearchKind, type GlobalSearchResult } from '@/hooks/useGlobalSearch';

const GROUP_LABELS: Record<GlobalSearchKind, string> = {
  camera: 'Cameras',
  vehicle: 'Vehicles',
  watchlist: 'Watchlist',
  alert: 'Alerts',
  location: 'Locations',
};

const ORDER: GlobalSearchKind[] = ['camera', 'vehicle', 'watchlist', 'alert', 'location'];

/**
 * Global command search. Searches cameras, vehicles, watchlist entries and
 * alerts through the existing APIs (bundled-data fallback when offline) and
 * navigates to the matching page/detail. Handles loading, empty and error
 * states, and collapses to a compact icon control on small screens.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const search = useGlobalSearch(query);

  // Close the desktop dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Close the mobile overlay on Escape.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const selectResult = (result: GlobalSearchResult) => {
    navigate(result.to);
    setQuery('');
    setOpen(false);
    setMobileOpen(false);
  };

  const grouped = ORDER.map((kind) => ({ kind, items: search.results.filter((r) => r.kind === kind) })).filter(
    (group) => group.items.length > 0,
  );

  const Input = (
    <div className="relative w-full">
      <Search
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6d7f9e]"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const first = search.results[0];
            if (first) selectResult(first);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder="Search Vehicle / Camera / Location..."
        className="h-[38px] w-full rounded-[6px] border border-edge bg-[#0c1424] pl-9 pr-9 text-[13.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery('')}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[4px] text-[#6d7f9e] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );

  const ResultsPanel = (
    <div className="animate-fade-in overflow-hidden rounded-[6px] border border-edge bg-[#0b1222] shadow-panel">
      {search.status === 'idle' ? (
        <div className="flex items-center gap-2 px-4 py-4 text-[12.5px] text-ink-dim">
          <Search size={14} className="text-[#6d7f9e]" />
          Type a vehicle plate, camera ID, location or alert…
        </div>
      ) : search.status === 'loading' ? (
        <div className="flex items-center gap-2.5 px-4 py-3.5 text-[12.5px] text-ink-dim">
          <Loader2 size={14} className="animate-spin text-accent-blue" />
          Searching the network…
        </div>
      ) : search.status === 'error' ? (
        <div className="flex flex-col gap-1 px-4 py-4 text-[12.5px] text-ink-dim">
          <span className="font-medium text-[#f87171]">Search service unreachable</span>
          <span className="text-[11.5px] text-ink-faint">Check the gateway connection and try again.</span>
        </div>
      ) : latestHasNoResults(search, grouped) ? (
        <div className="px-4 py-4 text-center text-[12.5px] text-ink-dim">
          No matches for “{search.query}”.
          <span className="mt-1 block text-[11.5px] text-ink-faint">Try a plate, camera ID, location or alert.</span>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto scroll-thin py-1">
          {grouped.map((group) => (
            <div key={group.kind} className="mb-0.5">
              <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {GROUP_LABELS[group.kind]}
              </div>
              {group.items.map((item) => (
                <button
                  key={`${group.kind}-${item.id}`}
                  type="button"
                  onClick={() => selectResult(item)}
                  className="group flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-panel-hover"
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[5px] bg-panel-alt ring-1 ring-edge ${item.tone}`}>
                    <item.icon size={14} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{item.label}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">{item.sub}</span>
                  </span>
                  <MapPin size={12} className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const desktopDropdownOpen = open && query.trim().length > 0;

  return (
    <>
      {/* Desktop: inline centered search with a results dropdown */}
      <div ref={searchRef} className="relative hidden w-[clamp(280px,24vw,460px)] lg:block">
        {Input}
        {desktopDropdownOpen ? <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50">{ResultsPanel}</div> : null}
      </div>

      {/* Mobile: compact icon that expands a full-width overlay */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Open search"
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <Search size={18} strokeWidth={1.8} />
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="mx-auto mt-24 w-[min(560px,92vw)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Global Search</span>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-[6px] text-ink-dim transition-colors hover:bg-panel-hover hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            {Input}
            <div className="mt-2">{ResultsPanel}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** True when the search finished and returned no grouped results at all. */
function latestHasNoResults(search: { status: string; results: GlobalSearchResult[] }, grouped: Array<{ kind: GlobalSearchKind; items: GlobalSearchResult[] }>): boolean {
  return search.status === 'ready' && grouped.length === 0;
}
