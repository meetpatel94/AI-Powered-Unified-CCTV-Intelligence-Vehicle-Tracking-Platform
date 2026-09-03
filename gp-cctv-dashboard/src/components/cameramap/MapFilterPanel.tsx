import type { ReactNode } from 'react';
import { useState } from 'react';

import { ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react';

import { codecs, departments, statusFilters } from '@/data/cameraMapData';
import type { CameraMapFilters, MapCodec } from '@/types/cameraMap';

interface MapFilterPanelProps {
  filters: CameraMapFilters;
  onChange: (next: Partial<CameraMapFilters>) => void;
  counts: Record<string, number>;
  visibleCount: number;
  totalCount: number;
  onReset: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-edge-soft px-2.5 py-2 first:border-t-0">
      <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">{title}</div>
      {children}
    </div>
  );
}

/** Floating control deck on the left edge of the map. */
export function MapFilterPanel({
  filters,
  onChange,
  counts,
  visibleCount,
  totalCount,
  onReset,
}: MapFilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleDepartment = (dept: string) =>
    onChange({
      departments: filters.departments.includes(dept)
        ? filters.departments.filter((d) => d !== dept)
        : [...filters.departments, dept],
    });

  const toggleCodec = (codec: MapCodec) =>
    onChange({
      codecs: filters.codecs.includes(codec)
        ? filters.codecs.filter((c) => c !== codec)
        : [...filters.codecs, codec],
    });

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-30 flex max-h-[calc(100%-24px)] w-[min(300px,calc(100%-24px))] flex-col overflow-hidden rounded-md border border-edge bg-[#0a1220]/95 shadow-panel backdrop-blur-sm max-md:max-h-[40%]">
      <header className="flex shrink-0 items-center justify-between gap-1 border-b border-edge px-2.5 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
          <SlidersHorizontal size={11} className="text-accent-blue" />
          Map Filters
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onReset} className="link-action" title="Reset filters">
            Reset
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            className="text-[#8ea3c4] transition-transform hover:text-white"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-thin">
          <Section title="Location Search">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
              <input
                value={filters.query}
                onChange={(event) => onChange({ query: event.target.value })}
                placeholder="Camera, road or area..."
                className="h-[30px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-2 text-[12px] text-ink placeholder:text-[#6d7f9e] outline-none focus:border-accent-blue/70"
              />
            </div>
          </Section>

          <Section title="Camera Status">
            <div className="grid grid-cols-2 gap-1">
              {statusFilters.map((status) => {
                const active = filters.status === status.id;
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => onChange({ status: status.id })}
                    className={`flex items-center justify-between gap-1 rounded-[3px] border px-2 py-[4px] text-[13px] transition-colors ${
                      active
                        ? 'border-accent-blue/70 bg-accent-blue/15 text-white'
                        : 'border-edge bg-[#0c1424] text-[#a9bcd8] hover:border-edge-strong'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                      {status.label}
                    </span>
                    <span className="tnum text-[12.5px] text-[#7286a6]">{counts[status.id] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Department">
            <ul className="space-y-[3px]">
              {departments.map((dept) => {
                const active = filters.departments.includes(dept);
                return (
                  <li key={dept}>
                    <button
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      className="flex w-full items-center gap-2 rounded-[3px] px-1.5 py-[3px] text-[13px] text-[#c3cfe2] transition-colors hover:bg-panel-hover"
                    >
                      <span
                        className={`grid h-[14px] w-[14px] place-items-center rounded-[3px] border ${
                          active ? 'border-accent-blue bg-accent-blue' : 'border-edge-strong bg-[#0c1424]'
                        }`}
                      >
                        {active && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{dept}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Codec">
            <div className="flex flex-wrap gap-1">
              {codecs.map((codec) => {
                const active = filters.codecs.includes(codec);
                return (
                  <button
                    key={codec}
                    type="button"
                    onClick={() => toggleCodec(codec)}
                    className={`rounded-full border px-2.5 py-[3px] font-mono text-[12.5px] transition-colors ${
                      active
                        ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan'
                        : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong'
                    }`}
                  >
                    {codec}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Analytics">
            <div className="space-y-1">
              <Toggle
                label="ANPR Active"
                value={filters.anprOnly}
                onChange={() => onChange({ anprOnly: !filters.anprOnly })}
              />
              <Toggle
                label="AI Detection"
                value={filters.aiOnly}
                onChange={() => onChange({ aiOnly: !filters.aiOnly })}
              />
            </div>
          </Section>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-1 border-t border-edge bg-[#0c1424] px-2.5 py-2 text-[13px]">
            <span className="flex items-center gap-1 text-[#7286a6]">
              <Filter size={9} /> Visible
            </span>
            <span className="tnum text-[#c3cfe2]">
              <span className="font-semibold text-white">{visibleCount}</span> / {totalCount} cameras
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between gap-2 rounded-[3px] px-1.5 py-[3px] text-[13px] text-[#c3cfe2] transition-colors hover:bg-panel-hover"
    >
      {label}
      <span
        className={`relative h-[14px] w-[26px] rounded-full transition-colors ${
          value ? 'bg-accent-green' : 'bg-[#22314b]'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all ${
            value ? 'left-[13px]' : 'left-[2px]'
          }`}
        />
      </span>
    </button>
  );
}
