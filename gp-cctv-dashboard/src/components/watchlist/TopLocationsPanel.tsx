import { ArrowDown, ArrowUp, MapPin, Minus } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { topLocations } from '@/data/watchlistData';

const MAX = topLocations[0]?.matches ?? 1;

const rankTone = [
  'bg-accent-red/15 text-[#ff8b96] ring-accent-red/40',
  'bg-accent-orange/15 text-[#f7b95f] ring-accent-orange/40',
  'bg-accent-yellow/15 text-[#eddb6a] ring-accent-yellow/40',
];

const trendIcon = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const trendTone = { up: 'text-accent-green', down: 'text-accent-red', flat: 'text-[#6d7f9e]' } as const;

/** Bottom row right: ranked list of cameras/areas producing the most matches. */
export function TopLocationsPanel() {
  return (
    <Panel
      title="Top Matched Locations"
      action={<span className="tnum text-3xs text-ink-dim">this month</span>}
      className="min-h-0"
      bodyClassName="flex flex-col justify-between gap-1 overflow-y-auto px-2 pb-2 pt-1"
    >
      {topLocations.map((location) => {
        const Trend = trendIcon[location.trend];
        return (
          <div
            key={location.id}
            className="flex items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[4px] transition-colors hover:border-edge hover:bg-panel-hover"
          >
            <span
              className={`tnum grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] text-[9px] font-bold ring-1 ${
                rankTone[location.rank - 1] ?? 'bg-[#16233a] text-[#8ea1c0] ring-edge-strong'
              }`}
            >
              {location.rank}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <MapPin size={9} className="shrink-0 text-accent-cyan" />
                <span className="truncate text-[10px] font-semibold text-[#dbe6f5]">{location.name}</span>
                <span className="truncate text-[8.5px] text-[#6d7f9e]">· {location.city}</span>
              </span>
              <span className="mt-[3px] block h-[3px] overflow-hidden rounded-full bg-[#14243c]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan"
                  style={{ width: `${(location.matches / MAX) * 100}%` }}
                />
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              <Trend size={10} strokeWidth={2.4} className={trendTone[location.trend]} />
              <span className="tnum text-[10.5px] font-bold text-white">{location.matches}</span>
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
