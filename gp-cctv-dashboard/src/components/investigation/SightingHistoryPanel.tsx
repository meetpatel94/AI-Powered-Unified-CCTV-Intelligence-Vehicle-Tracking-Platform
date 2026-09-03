import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronsUpDown,
  Copy,
  Eye,
  Filter,
  MapPin,
  ScanSearch,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { SightingQuery, SightingSortDir, SightingSortKey, VehicleSighting } from '@/types/investigation';

interface SightingHistoryPanelProps {
  sightings: VehicleSighting[];
  totalCount: number;
  query: SightingQuery;
  onQuery: (patch: Partial<SightingQuery>) => void;
  onReset: () => void;
  dirty: boolean;
  cameraOptions: Array<{ id: string; label: string }>;
  includeReReads: boolean;
  onIncludeReReads: (value: boolean) => void;
  sortKey: SightingSortKey;
  sortDir: SightingSortDir;
  onSort: (key: SightingSortKey) => void;
  selectedId: string | null;
  onSelect: (sighting: VehicleSighting) => void;
}

/** Column order an investigator reads: where → when → how sure → what → which way → proof. */
const columns: Array<{ key: SightingSortKey | null; label: string; width: string }> = [
  { key: 'camera', label: 'Camera ID', width: '10%' },
  { key: 'location', label: 'Location', width: '25%' },
  { key: 'time', label: 'Timestamp', width: '9%' },
  { key: 'confidence', label: 'ANPR / plate confidence', width: '10%' },
  { key: 'type', label: 'Vehicle type', width: '14%' },
  { key: 'direction', label: 'Direction', width: '11%' },
  { key: null, label: 'Evidence / status', width: '21%' },
];

const confidenceTone = (value: number) =>
  value >= 96 ? 'text-[#6fe0b0]' : value >= 90 ? 'text-[#67e8f9]' : 'text-[#f7b95f]';

const selectCls =
  'h-[24px] max-w-full rounded-[4px] border border-edge bg-[#0c1424] px-1.5 text-[11.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

const toggleCls = (active: boolean) =>
  `flex h-[24px] shrink-0 items-center gap-1 rounded-[4px] border px-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors ${
    active
      ? 'border-accent-cyan/60 bg-[#083344]/70 text-[#67e8f9]'
      : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
  }`;

/**
 * SIGHTING HISTORY: every ANPR / AI read of the target in one full-width
 * table — camera, location, timestamp, plate confidence, vehicle type,
 * direction and the evidence / status of each read. Selecting a row opens
 * that sighting's evidence viewer.
 */
export function SightingHistoryPanel({
  sightings,
  totalCount,
  query,
  onQuery,
  onReset,
  dirty,
  cameraOptions,
  includeReReads,
  onIncludeReReads,
  sortKey,
  sortDir,
  onSort,
  selectedId,
  onSelect,
}: SightingHistoryPanelProps) {
  return (
    <Panel
      title="Sighting History"
      headerClassName="flex-wrap gap-y-1.5"
      tools={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="tnum flex shrink-0 items-center gap-1 text-3xs text-ink-dim">
            <Filter size={9} />
            {sightings.length} of {totalCount} readings
          </span>
          <select
            value={query.camera}
            onChange={(event) => onQuery({ camera: event.target.value })}
            aria-label="Filter by camera"
            className={`${selectCls} w-[148px]`}
          >
            <option value="all">All cameras</option>
            {cameraOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={String(query.minConfidence)}
            onChange={(event) => onQuery({ minConfidence: Number(event.target.value) })}
            aria-label="Minimum plate confidence"
            className={`${selectCls} w-[112px]`}
          >
            <option value="0">Any confidence</option>
            <option value="85">≥ 85%</option>
            <option value="90">≥ 90%</option>
            <option value="95">≥ 95%</option>
            <option value="97">≥ 97%</option>
          </select>
          <button
            type="button"
            onClick={() => onQuery({ primaryOnly: !query.primaryOnly })}
            className={toggleCls(query.primaryOnly)}
          >
            <MapPin size={10} />
            Route nodes only
          </button>
          <button
            type="button"
            onClick={() => onIncludeReReads(!includeReReads)}
            className={toggleCls(includeReReads)}
            title="ANPR second frames of the same pass"
          >
            <Copy size={10} />
            Include re-reads
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={onReset}
              className="flex h-[24px] shrink-0 items-center gap-1 rounded-[4px] border border-edge px-1.5 text-[11px] text-[#8ea3c4] transition-colors hover:border-accent-red/50 hover:text-[#ff8b96]"
            >
              <XCircle size={10} />
              Reset
            </button>
          ) : null}
        </div>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col px-3 pb-2 pt-1"
    >
      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            {columns.map((column) => (
              <col key={column.label} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((column) => {
                const active = column.key !== null && sortKey === column.key;
                return (
                  <th
                    key={column.label}
                    className="border-b border-edge bg-panel px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#7f93b3]"
                  >
                    {column.key ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.key as SightingSortKey)}
                        className={`flex items-center gap-1 transition-colors hover:text-white ${active ? 'text-accent-cyan' : ''}`}
                      >
                        <span className="truncate">{column.label}</span>
                        {active ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={9} strokeWidth={2.6} className="shrink-0" />
                          ) : (
                            <ArrowDown size={9} strokeWidth={2.6} className="shrink-0" />
                          )
                        ) : (
                          <ChevronsUpDown size={9} className="shrink-0 text-[#3f5170]" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="min-h-0">
            {sightings.map((sighting) => {
              const active = selectedId === sighting.id;
              return (
                <tr
                  key={sighting.id}
                  onClick={() => onSelect(sighting)}
                  className={`group cursor-pointer transition-colors ${
                    active ? 'bg-[#083344]/50' : 'hover:bg-panel-hover'
                  }`}
                >
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="flex items-center gap-1">
                      <span className="tnum truncate font-mono text-[12px] font-bold text-white">{sighting.cameraId}</span>
                      {sighting.journeyStep ? (
                        <span className="shrink-0 rounded-[2px] bg-accent-cyan/20 px-1 text-[9.5px] font-bold text-[#67e8f9]">
                          N{sighting.journeyStep}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="block truncate text-[12px] font-medium text-[#dbe6f5]">{sighting.location}</span>
                    <span className="block truncate text-[10px] text-[#6d82a3]">
                      {sighting.area} · {sighting.city}
                    </span>
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="tnum block truncate font-mono text-[12px] font-semibold text-[#dbe6f5]">
                      {sighting.time}
                    </span>
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className={`tnum block truncate text-[12px] font-bold ${confidenceTone(sighting.confidence)}`}>
                      {sighting.confidence.toFixed(1)}%
                    </span>
                    {sighting.note ? (
                      <span className="block truncate text-[9.5px] text-[#7f93b3]">{sighting.note}</span>
                    ) : null}
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="block truncate text-[11.5px] text-[#dbe6f5]">{sighting.vehicleType}</span>
                    <span className="tnum block truncate text-[10px] text-[#6d82a3]">
                      {sighting.make} · {sighting.speedKph} km/h
                    </span>
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="flex items-center gap-1 text-[11.5px] text-[#dbe6f5]">
                      <ArrowUpRight
                        size={11}
                        className="shrink-0 text-accent-cyan"
                        style={{ transform: `rotate(${directionRotation(sighting.direction)}deg)` }}
                      />
                      <span className="truncate">{sighting.direction}</span>
                    </span>
                  </td>
                  <td className="border-b border-edge-soft px-2 py-[6px] align-middle">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`relative h-[26px] w-[44px] shrink-0 overflow-hidden rounded-[3px] border ${
                          sighting.watchlistHit ? 'border-accent-red/70' : 'border-edge-soft'
                        }`}
                      >
                        <img src={sighting.thumbnail} alt="" className="h-full w-full object-cover" />
                        {sighting.watchlistHit ? <span className="absolute inset-0 bg-accent-red/20" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#9fc7ff] transition-colors group-hover:text-accent-cyan">
                          <Eye size={9} className="shrink-0" />
                          View evidence
                        </span>
                        <span className="mt-px flex flex-wrap items-center gap-1">
                          {sighting.watchlistHit ? (
                            <span className="flex items-center gap-0.5 rounded-[2px] bg-[#2a0d13] px-1 text-[9px] font-bold uppercase text-[#ff8b96]">
                              <ShieldAlert size={7} /> watchlist
                            </span>
                          ) : null}
                          {sighting.reRead ? (
                            <span className="rounded-[2px] bg-[#16233a] px-1 text-[9px] font-semibold uppercase text-[#9fb0cc]">
                              re-read
                            </span>
                          ) : null}
                          <span className="tnum truncate text-[9.5px] text-[#6d82a3]">
                            {sighting.frames.length + 1} frames
                          </span>
                        </span>
                      </span>
                      <ScanSearch size={11} className="shrink-0 text-[#3f5170] transition-colors group-hover:text-accent-cyan" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sightings.length === 0 ? (
        <div className="grid h-[80px] shrink-0 place-items-center rounded-[5px] border border-dashed border-edge px-3 text-center text-[12px] text-ink-dim">
          No sighting matches the current filters — widen the confidence or camera selection.
        </div>
      ) : null}
    </Panel>
  );
}

/** Compass → rotation for the direction arrow (screen space, 0° = up). */
function directionRotation(direction: string): number {
  const map: Record<string, number> = {
    North: 0,
    'North-East': 45,
    East: 90,
    'South-East': 135,
    South: 180,
    'South-West': 225,
    West: 270,
    'North-West': 315,
  };
  return map[direction] ?? 0;
}
