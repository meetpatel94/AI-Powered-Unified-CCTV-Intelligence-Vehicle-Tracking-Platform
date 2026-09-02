import { ArrowDownUp, Search, XCircle } from 'lucide-react';

import { sortOptions, statusMeta } from '@/data/cameraHealthData';

import type { HealthFilters, HealthSortKey, HealthStatus, SortDir } from '@/types/cameraHealth';

interface CameraHealthToolbarProps {
  filters: HealthFilters;
  onFilters: (next: Partial<HealthFilters>) => void;
  counts: Record<'all' | HealthStatus, number>;
  departments: string[];
  cities: string[];
  codecs: string[];
  resolutions: string[];
  sortKey: HealthSortKey;
  sortDir: SortDir;
  onSortKey: (key: HealthSortKey) => void;
  onSortDir: () => void;
  onReset: () => void;
  dirty: boolean;
  shown: number;
}

const selectCls =
  'h-[32px] shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[13px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

const chips: Array<{ id: 'all' | HealthStatus; label: string }> = [
  { id: 'all', label: 'All Cameras' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
  { id: 'poor', label: 'Poor Signal' },
  { id: 'reconnecting', label: 'Reconnecting' },
  { id: 'critical', label: 'Critical' },
];

/** Status chips + department / location / codec / resolution filters + search + sort. */
export function CameraHealthToolbar({
  filters,
  onFilters,
  counts,
  departments,
  cities,
  codecs,
  resolutions,
  sortKey,
  sortDir,
  onSortKey,
  onSortDir,
  onReset,
  dirty,
  shown,
}: CameraHealthToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-md border border-edge bg-panel px-2 py-2">
      {/* status chips */}
      <div className="flex shrink-0 items-center gap-px overflow-hidden rounded-[5px] border border-edge bg-[#0a1120] p-px">
        {chips.map((chip) => {
          const isActive = filters.status === chip.id;
          const meta = chip.id === 'all' ? null : statusMeta[chip.id];
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFilters({ status: chip.id })}
              className={`tnum flex h-[30px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12.5px] font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.9)]'
                  : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
              }`}
            >
              {meta ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: meta.color, boxShadow: isActive ? 'none' : `0 0 6px -1px ${meta.color}` }}
                />
              ) : null}
              {chip.label}
              <span
                className={`rounded-[3px] px-1.5 text-[11.5px] font-bold leading-[14px] ${
                  isActive ? 'bg-black/25 text-white' : 'bg-[#101a2e] text-ink-faint'
                }`}
              >
                {counts[chip.id]}
              </span>
            </button>
          );
        })}
      </div>

      <span className="mx-0.5 h-[22px] w-px shrink-0 bg-edge" />

      {/* search */}
      <div className="relative min-w-[180px] flex-1">
        <Search size={12} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-faint" />
        <input
          value={filters.query}
          onChange={(event) => onFilters({ query: event.target.value })}
          placeholder="Search camera ID, location, area, IP…"
          className="h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] pr-6 pl-[26px] text-[13px] text-[#e6edf7] outline-none transition-colors placeholder:text-ink-faint hover:border-edge-strong focus:border-accent-blue/70"
        />
        {filters.query ? (
          <button
            type="button"
            title="Clear search"
            onClick={() => onFilters({ query: '' })}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-faint transition-colors hover:text-white"
          >
            <XCircle size={12} />
          </button>
        ) : null}
      </div>

      {/* department / location */}
      <label className="flex items-center gap-1.5">
        <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Dept</span>
        <select
          value={filters.department}
          onChange={(event) => onFilters({ department: event.target.value })}
          className={selectCls}
          title="Filter by responsible department"
        >
          <option value="all">All departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Loc</span>
        <select
          value={filters.city}
          onChange={(event) => onFilters({ city: event.target.value })}
          className={selectCls}
          title="Filter by city / district"
        >
          <option value="all">All locations</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <select
        value={filters.codec}
        onChange={(event) => onFilters({ codec: event.target.value })}
        className={selectCls}
        title="Filter by stream codec"
      >
        <option value="all">All codecs</option>
        {codecs.map((codec) => (
          <option key={codec} value={codec}>
            {codec}
          </option>
        ))}
      </select>

      <select
        value={filters.resolution}
        onChange={(event) => onFilters({ resolution: event.target.value })}
        className={selectCls}
        title="Filter by capture resolution"
      >
        <option value="all">All resolutions</option>
        {resolutions.map((resolution) => (
          <option key={resolution} value={resolution}>
            {resolution}
          </option>
        ))}
      </select>

      <span className="mx-0.5 h-[22px] w-px shrink-0 bg-edge" />

      {/* sort */}
      <label className="flex items-center gap-1.5">
        <ArrowDownUp size={11} className="text-ink-faint" />
        <select value={sortKey} onChange={(event) => onSortKey(event.target.value as HealthSortKey)} className={selectCls} title="Sort cameras">
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onSortDir}
        title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
        className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
      >
        <span className={`tnum font-mono text-[11px] font-bold ${sortDir === 'desc' ? 'rotate-180' : ''}`}>↑</span>
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={!dirty}
        title="Reset every filter"
        className={`flex h-[28px] shrink-0 items-center gap-1 rounded-[4px] border px-2 text-[12px] font-medium transition-colors ${
          dirty
            ? 'border-edge bg-panel-alt text-[#c3cfe2] hover:border-edge-strong hover:text-white'
            : 'cursor-not-allowed border-edge/60 bg-transparent text-ink-faint/60'
        }`}
      >
        <XCircle size={11} />
        Reset
      </button>

      <span className="tnum ml-auto shrink-0 font-mono text-[11.5px] text-ink-faint">
        <span className="text-[#9fc7ff]">{shown}</span> / {counts.all} monitored feeds
      </span>
    </div>
  );
}
