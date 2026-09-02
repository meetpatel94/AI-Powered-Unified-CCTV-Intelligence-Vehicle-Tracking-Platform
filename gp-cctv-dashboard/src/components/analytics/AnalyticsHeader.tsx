import { BarChart3, CalendarDays, Camera, Download, MapPin, RefreshCw } from 'lucide-react';

import { cameraOptions, camerasForLocation, dateRangeOptions, locationOptions } from '@/data/analyticsData';
import type { AnalyticsFilters, DateRangeId, LocationId } from '@/types/analytics';

interface AnalyticsHeaderProps {
  filters: AnalyticsFilters;
  onFilters: (next: Partial<AnalyticsFilters>) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onExport: () => void;
  clock: string;
}

const selectCls =
  'h-[34px] shrink-0 rounded-[5px] border border-edge bg-[#0c1424] pl-8 pr-2 text-[12.5px] font-medium text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

const secondaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

/** Page title bar: AI ANALYTICS identity + date / location / camera / export / refresh. */
export function AnalyticsHeader({ filters, onFilters, refreshing, onRefresh, onExport, clock }: AnalyticsHeaderProps) {
  const cameras = camerasForLocation(filters.location);
  const cameraValue = cameras.some((option) => option.id === filters.camera) ? filters.camera : 'all';

  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-accent-purple">
          AI Analytics &amp; Intelligence
        </div>
        <h1 className="mt-[2px] page-title flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] border border-accent-purple/40 bg-accent-purple/15 shadow-[0_0_12px_-3px_rgba(168,85,247,0.55)]">
            <BarChart3 size={18} className="text-accent-purple" />
          </span>
          AI Analytics
        </h1>
        <p className="page-sub mt-1">
          Real-time CCTV intelligence, detection trends and operational insights
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <label className="relative">
          <CalendarDays size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <select
            aria-label="Date range"
            value={filters.range}
            onChange={(event) => onFilters({ range: event.target.value as DateRangeId })}
            className={`${selectCls} w-[148px]`}
          >
            {dateRangeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative">
          <MapPin size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <select
            aria-label="Location"
            value={filters.location}
            onChange={(event) => {
              const location = event.target.value as LocationId;
              const nextCameras = camerasForLocation(location);
              const camera = nextCameras.some((option) => option.id === filters.camera) ? filters.camera : 'all';
              onFilters({ location, camera });
            }}
            className={`${selectCls} w-[158px]`}
          >
            {locationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative">
          <Camera size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <select
            aria-label="Camera"
            value={cameraValue}
            onChange={(event) => onFilters({ camera: event.target.value })}
            className={`${selectCls} w-[188px]`}
          >
            {(filters.location === 'all' ? cameraOptions : cameras).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" title="Export current snapshot as CSV" onClick={onExport} className={secondaryBtn}>
          <Download size={14} strokeWidth={2} />
          Export Report
        </button>

        <button
          type="button"
          title="Refresh analytics"
          onClick={onRefresh}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin text-white' : ''} />
          Refresh
        </button>

        <span className="tnum ml-1 hidden rounded-[4px] border border-edge bg-panel px-2.5 py-[7px] text-[12.5px] text-[#c3cfe2] xl:inline">
          {clock}
        </span>
      </div>
    </div>
  );
}
