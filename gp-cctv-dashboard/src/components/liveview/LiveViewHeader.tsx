import type { ReactNode } from 'react';

import { Grid2x2, Grid3x3, LayoutGrid, Maximize, Radio, Search, Video } from 'lucide-react';

import {
  cameraFilters,
  codecOptions,
  departmentOptions,
  locationOptions,
  statusOptions,
} from '@/data/liveViewData';
import type { CameraFilterId } from '@/types/liveView';

export type GridSize = 2 | 3 | 4;

interface LiveViewHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: CameraFilterId;
  onFilterChange: (id: CameraFilterId) => void;
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  counts: {
    total: number;
    online: number;
    offline: number;
    unavailable: number;
    critical: number;
    anpr: number;
    ai: number;
  };
  clock: string;
}

function Select({ options, width = 'w-[140px]' }: { options: string[]; width?: string }) {
  return (
    <select
      defaultValue={options[0]}
      className={`h-[32px] ${width} shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[12.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70`}
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-[#0c1424]">
          {option}
        </option>
      ))}
    </select>
  );
}

/** Page title bar + full filter/toolbar strip for the live wall. */
export function LiveViewHeader({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  gridSize,
  onGridSizeChange,
  counts,
  clock,
}: LiveViewHeaderProps) {
  const chipCount: Record<CameraFilterId, number> = {
    all: counts.total,
    online: counts.online,
    offline: counts.unavailable,
    critical: counts.critical,
    anpr: counts.anpr,
    ai: counts.ai,
  };

  return (
    <div className="shrink-0 space-y-2.5">
      {/* title row */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2.5">
            <Radio size={20} className="text-accent-red animate-pulse-dot" />
            Live CCTV Monitoring
          </h1>
          <p className="page-sub mt-0.5">Real-time camera feeds and stream intelligence</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Stat label="Live Cameras" value={counts.total.toString().padStart(2, '0')} tone="text-white" icon={<Video size={14} className="text-accent-blue" />} />
          <StatusPill tone="green" label="Online" value={counts.online} />
          <StatusPill tone="amber" label="Reconnecting" value={counts.total - counts.online - counts.offline} />
          <StatusPill tone="red" label="Offline" value={counts.offline} />
          <div className="tnum ml-1 rounded-[4px] border border-edge bg-panel px-2.5 py-[7px] text-[12.5px] text-[#c3cfe2]">
            {clock}
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-panel px-3 py-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search camera ID, location or zone..."
            className="h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-8 pr-2 text-[13px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
          />
        </div>

        <Select options={locationOptions} />
        <Select options={departmentOptions} width="w-[150px]" />
        <Select options={statusOptions} width="w-[120px]" />
        <Select options={codecOptions} width="w-[110px]" />

        <div className="flex items-center gap-px overflow-hidden rounded-[4px] border border-edge">
          {([2, 3, 4] as GridSize[]).map((size) => {
            const Icon = size === 2 ? Grid2x2 : size === 3 ? Grid3x3 : LayoutGrid;
            const active = gridSize === size;
            return (
              <button
                key={size}
                type="button"
                title={`${size} x ${size} grid`}
                onClick={() => onGridSizeChange(size)}
                className={`grid h-[30px] w-[32px] place-items-center transition-colors ${
                  active ? 'bg-[#1d6ce0] text-white' : 'bg-[#0c1424] text-[#8ea3c4] hover:text-white'
                }`}
              >
                <Icon size={14} strokeWidth={2} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          title="Fullscreen wall"
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-[#8ea3c4] transition-colors hover:text-white"
        >
          <Maximize size={14} strokeWidth={2} />
        </button>
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {cameraFilters.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFilterChange(chip.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-[4px] text-[12px] transition-colors ${
                active
                  ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                  : 'border-edge bg-panel text-ink-dim hover:border-edge-strong hover:text-ink'
              }`}
            >
              {chip.label}
              <span
                className={`tnum rounded-full px-1.5 py-px text-[12.5px] ${
                  active ? 'bg-accent-blue/25 text-[#cfe3ff]' : 'bg-[#16233a] text-[#7f92b3]'
                }`}
              >
                {chipCount[chip.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[4px] border border-edge bg-panel px-2.5 py-[6px]">
      {icon}
      <span className="text-[13px] uppercase tracking-wide text-ink-dim">{label}</span>
      <span className={`tnum text-[15px] font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function StatusPill({ tone, label, value }: { tone: 'green' | 'amber' | 'red'; label: string; value: number }) {
  const map = {
    green: 'text-accent-green bg-accent-green/10 ring-accent-green/30',
    amber: 'text-accent-orange bg-accent-orange/10 ring-accent-orange/30',
    red: 'text-accent-red bg-accent-red/10 ring-accent-red/30',
  } as const;
  const dot = { green: 'bg-accent-green', amber: 'bg-accent-orange', red: 'bg-accent-red' } as const;

  return (
    <span className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-[6px] text-[12px] ring-1 ${map[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]} animate-pulse-dot`} />
      {label}
      <span className="tnum font-semibold">{value}</span>
    </span>
  );
}
