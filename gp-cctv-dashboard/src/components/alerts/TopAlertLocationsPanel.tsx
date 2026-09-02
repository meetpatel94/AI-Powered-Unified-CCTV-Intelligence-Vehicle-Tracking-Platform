import { ArrowDown, ArrowUp, Camera, Minus } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { topAlertLocations } from '@/data/alertsData';

const MAX = topAlertLocations[0]?.alerts ?? 1;

const rankTone = [
  'bg-accent-red/15 text-[#ff8b96] ring-accent-red/40',
  'bg-accent-orange/15 text-[#f7b95f] ring-accent-orange/40',
  'bg-accent-yellow/15 text-[#eddb6a] ring-accent-yellow/40',
];

const trendIcon = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const trendTone = { up: 'text-accent-red', down: 'text-accent-green', flat: 'text-[#6d7f9e]' } as const;

/** Bottom row 4: camera areas producing the most alerts this morning. */
export function TopAlertLocationsPanel() {
  return (
    <Panel
      title="Top Alert Locations"
      action={<span className="tnum text-3xs text-ink-dim">06:00–10:46</span>}
      className="h-full min-h-0"
      bodyClassName="flex flex-col justify-between gap-px overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {topAlertLocations.map((location) => {
        const Trend = trendIcon[location.trend];
        return (
          <div
            key={location.id}
            className="flex items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[3px] transition-colors hover:border-edge hover:bg-panel-hover"
          >
            <span
              className={`tnum grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[4px] text-[10.5px] font-bold ring-1 ${
                rankTone[location.rank - 1] ?? 'bg-[#16233a] text-[#8ea1c0] ring-edge-strong'
              }`}
            >
              {location.rank}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <Camera size={8.5} className="shrink-0 text-accent-cyan" />
                <span className="truncate text-[11.5px] font-semibold text-[#dbe6f5]">{location.name}</span>
                <span className="truncate text-[10px] text-[#6d7f9e]">· {location.city}</span>
              </span>
              <span className="mt-[2px] block h-[2.5px] overflow-hidden rounded-full bg-[#14243c]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan transition-all duration-500"
                  style={{ width: `${(location.alerts / MAX) * 100}%` }}
                />
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              <span className="tnum hidden text-[9.5px] text-[#55668a] 2xl:inline">{location.peak}</span>
              <Trend size={9.5} strokeWidth={2.4} className={trendTone[location.trend]} />
              <span className="tnum text-[12px] font-bold text-white">{location.alerts}</span>
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
