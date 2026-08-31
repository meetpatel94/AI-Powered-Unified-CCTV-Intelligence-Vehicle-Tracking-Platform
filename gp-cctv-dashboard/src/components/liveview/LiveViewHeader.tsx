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

function Select({ options, width = 'w-[132px]' }: { options: string[]; width?: string }) {
  return (
    <select
      defaultValue={options[0]}
      className={`h-[28px] ${width} shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[10.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70`}
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
    <div className="shrink-0 space-y-2">
      {/* title row */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.1em] text-white">
            <Radio size={15} className="text-accent-red animate-pulse-dot" />
            Live CCTV Monitoring
          </h1>
          <p className="mt-[1px] text-[10.5px] text-ink-dim">
            Real-time camera feeds and stream intelligence
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Stat label="Live Cameras" value={counts.total.toString().padStart(2, '0')} tone="text-white" icon={<Video size={12} className="text-accent-blue" />} />
          <StatusPill tone="green" label="Online" value={counts.online} />
          <StatusPill tone="amber" label="Reconnecting" value={counts.total - counts.online - counts.offline} />
          <StatusPill tone="red" label="Offline" value={counts.offline} />
          <div className="tnum ml-1 rounded-[4px] border border-edge bg-panel px-2 py-[5px] text-[10.5px] text-[#c3cfe2]">
            {clock}
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-panel px-2.5 py-2">
        <div className="relative min-w-[210px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search camera ID, location or zone..."
            className="h-[28px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-2 text-[10.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
          />
        </div>

        <Select options={locationOptions} />
        <Select options={departmentOptions} width="w-[142px]" />
        <Select options={statusOptions} width="w-[112px]" />
        <Select options={codecOptions} width="w-[104px]" />

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
                className={`grid h-[26px] w-[28px] place-items-center transition-colors ${
                  active ? 'bg-[#1d6ce0] text-white' : 'bg-[#0c1424] text-[#8ea3c4] hover:text-white'
                }`}
              >
                <Icon size={13} strokeWidth={2} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          title="Fullscreen wall"
          className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-[#8ea3c4] transition-colors hover:text-white"
        >
          <Maximize size={13} strokeWidth={2} />
        </button>
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {cameraFilters.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFilterChange(chip.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] transition-colors ${
                active
                  ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                  : 'border-edge bg-panel text-ink-dim hover:border-edge-strong hover:text-ink'
              }`}
            >
              {chip.label}
              <span
                className={`tnum rounded-full px-1 text-[8.5px] ${
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
    <div className="flex items-center gap-1.5 rounded-[4px] border border-edge bg-panel px-2 py-[4px]">
      {icon}
      <span className="text-[9.5px] uppercase tracking-wide text-ink-dim">{label}</span>
      <span className={`tnum text-[12px] font-bold ${tone}`}>{value}</span>
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
    <span className={`flex items-center gap-1.5 rounded-[4px] px-2 py-[5px] text-[10px] ring-1 ${map[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]} animate-pulse-dot`} />
      {label}
      <span className="tnum font-semibold">{value}</span>
    </span>
  );
}
