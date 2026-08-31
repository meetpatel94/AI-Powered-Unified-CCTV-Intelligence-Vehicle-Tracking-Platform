import { Search } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { trackedVehicle } from '@/data/mockData';

const anprMeta = [
  { label: 'ANPR', value: '98.6%', tone: 'text-accent-green' },
  { label: 'Speed', value: '62 km/h', tone: 'text-[#dbe5f4]' },
  { label: 'Heading', value: 'North-East', tone: 'text-[#dbe5f4]' },
  { label: 'Sightings', value: '4', tone: 'text-[#dbe5f4]' },
];

/** ANPR plate lookup with the currently resolved vehicle dossier. */
export function VehicleSearchPanel() {
  return (
    <Panel title="Vehicle Search" className="h-full" bodyClassName="flex flex-col gap-2 px-2.5 pb-2.5 pt-1">
      {/* search bar */}
      <form className="flex shrink-0 items-center gap-1.5" onSubmit={(event) => event.preventDefault()}>
        <div className="relative flex-1">
          <Search
            size={12.5}
            strokeWidth={2}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]"
          />
          <input
            defaultValue={trackedVehicle.plate}
            aria-label="Search number plate"
            className="h-[30px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-2 text-[11px] tracking-wide text-ink outline-none transition-colors focus:border-accent-blue/70"
          />
        </div>
        <button
          type="submit"
          className="h-[30px] shrink-0 rounded-[4px] bg-[#1d6ce0] px-3.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#2a7bf0]"
        >
          Search
        </button>
      </form>

      {/* dossier */}
      <div className="flex shrink-0 items-start gap-2.5">
        <div className="h-[96px] w-[40%] shrink-0 overflow-hidden rounded-[4px] border border-edge-soft bg-black">
          <img
            src={trackedVehicle.snapshot}
            alt={`${trackedVehicle.plate} snapshot`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[15px] font-bold leading-tight tracking-wide text-white">
            {trackedVehicle.plate}
          </div>

          {trackedVehicle.watchlistMatch && (
            <span className="mt-1 w-fit rounded-[3px] border border-accent-red px-1.5 py-[2px] text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#ff8b96]">
              Watchlist Match
            </span>
          )}

          <dl className="mt-1.5 space-y-[3px]">
            <div>
              <dt className="text-[9px] leading-[11px] text-[#7286a6]">Vehicle Type</dt>
              <dd className="text-[10.5px] leading-[13px] text-[#dbe5f4]">{trackedVehicle.type}</dd>
            </div>
            <div>
              <dt className="text-[9px] leading-[11px] text-[#7286a6]">Color</dt>
              <dd className="text-[10.5px] leading-[13px] text-[#dbe5f4]">{trackedVehicle.color}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* live ANPR telemetry */}
      <div className="grid shrink-0 grid-cols-2 gap-x-2.5 gap-y-1 rounded-[4px] border border-edge-soft bg-[#0c1424] px-2 py-1.5">
        {anprMeta.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-1">
            <span className="text-[9px] text-[#7286a6]">{item.label}</span>
            <span className={`tnum text-[9.5px] font-medium ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* seen window */}
      <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 border-t border-edge-soft pt-1.5">
        <div>
          <div className="text-[9px] text-[#7286a6]">First Seen</div>
          <div className="tnum text-[10.5px] text-[#dbe5f4]">{trackedVehicle.firstSeen}</div>
        </div>
        <div>
          <div className="text-[9px] text-[#7286a6]">Last Seen</div>
          <div className="tnum text-[10.5px] text-[#dbe5f4]">{trackedVehicle.lastSeen}</div>
        </div>
      </div>
    </Panel>
  );
}
