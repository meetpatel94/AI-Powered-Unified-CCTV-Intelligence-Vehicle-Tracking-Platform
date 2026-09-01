import { CalendarClock, Camera as CameraIcon, Download, MapPin, Plus, RefreshCw, Search, Siren } from 'lucide-react';

import { dateRangeOptions, locationOptions } from '@/data/investigationData';
import type { InvestigationFilters, InvestigationStatus } from '@/types/investigation';

interface InvestigationHeaderProps {
  caseId: string;
  status: InvestigationStatus;
  openedAt: string;
  openedBy: string;
  unit: string;
  plate: string;
  onPlate: (value: string) => void;
  onSearch: () => void;
  filters: InvestigationFilters;
  onFilters: (patch: Partial<InvestigationFilters>) => void;
  cameraOptions: Array<{ id: string; label: string }>;
  onNew: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  clock: string;
  sightingCount: number;
}

const secondaryBtn =
  'flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 text-[10.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

const selectCls =
  'h-[30px] shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 text-[10.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

const statusTone: Record<InvestigationStatus, string> = {
  active: 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]',
  monitoring: 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]',
  escalated: 'border-accent-red/50 bg-[#2b0b10] text-[#ff8b96]',
  closed: 'border-edge-strong bg-[#141b2b] text-[#93a3bd]',
};

/**
 * Page title bar for the investigation console: identity, live case chip and
 * the workspace controls (new case, plate search, date / time range, location
 * and camera filters, case export, refresh).
 */
export function InvestigationHeader({
  caseId,
  status,
  openedAt,
  openedBy,
  unit,
  plate,
  onPlate,
  onSearch,
  filters,
  onFilters,
  cameraOptions,
  onNew,
  onExport,
  onRefresh,
  refreshing,
  clock,
  sightingCount,
}: InvestigationHeaderProps) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.1em] text-white">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-cyan/40 bg-accent-cyan/15 shadow-[0_0_12px_-3px_rgba(34,211,238,0.55)]">
            <Siren size={14} className="text-accent-cyan" />
          </span>
          Investigation
          <span className="ml-1 hidden rounded-[4px] border border-edge bg-panel px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8ea3c4] xl:inline">
            &amp; Vehicle Intelligence
          </span>
        </h1>
        <p className="mt-[3px] text-[10.5px] text-ink-dim">
          Trace vehicles, analyze cross-camera movements and investigate detected events
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="tnum rounded-[4px] border border-edge bg-panel px-1.5 py-[2px] text-[9px] font-semibold text-[#c3cfe2]">
            {caseId}
          </span>
          <span
            className={`flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-[0.08em] ${statusTone[status]}`}
          >
            <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
            {status}
          </span>
          <span className="tnum text-[9px] text-[#7f93b3]">
            opened {openedAt} · {openedBy} · {unit}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {/* plate search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <input
            value={plate}
            onChange={(event) => onPlate(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch();
            }}
            aria-label="Search vehicle or plate"
            placeholder="Search Vehicle / Plate…"
            className="tnum h-[30px] w-[186px] rounded-[5px] border border-edge bg-[#0c1424] pl-7 pr-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow"
          />
        </div>

        {/* date + time range */}
        <div className="flex items-center gap-1 rounded-[5px] border border-edge bg-[#0c1424] px-1.5">
          <CalendarClock size={12} className="shrink-0 text-[#6d7f9e]" />
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilters({ date: event.target.value })}
            aria-label="Investigation date"
            className="tnum h-[26px] bg-transparent text-[10px] text-[#c3cfe2] outline-none [color-scheme:dark]"
          />
          <span className="h-[16px] w-px bg-edge" />
          <select
            value={filters.range}
            onChange={(event) => onFilters({ range: event.target.value })}
            aria-label="Time range"
            className="h-[26px] bg-transparent pr-1 text-[10px] text-[#c3cfe2] outline-none"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* location + camera filters */}
        <div className="relative">
          <MapPin size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <select
            value={filters.location}
            onChange={(event) => onFilters({ location: event.target.value })}
            aria-label="Location filter"
            className={`${selectCls} w-[132px] pl-6`}
          >
            {locationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <CameraIcon size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <select
            value={filters.camera}
            onChange={(event) => onFilters({ camera: event.target.value })}
            aria-label="Camera filter"
            className={`${selectCls} w-[168px] pl-6`}
          >
            <option value="all">All Cameras</option>
            {cameraOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <span className="tnum ml-0.5 flex items-center gap-1 text-[9px] text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          {sightingCount} readings · {clock}
        </span>

        <button type="button" title="Refresh investigation" onClick={onRefresh} className={secondaryBtn}>
          <RefreshCw size={12} strokeWidth={2} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
          Refresh
        </button>

        <button type="button" title="Export the case bundle" onClick={onExport} className={secondaryBtn}>
          <Download size={12} strokeWidth={2} />
          Export Case
        </button>

        <button
          type="button"
          onClick={onNew}
          className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3 text-[10.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <Plus size={13} strokeWidth={2.6} />
          New Investigation
        </button>
      </div>
    </div>
  );
}
