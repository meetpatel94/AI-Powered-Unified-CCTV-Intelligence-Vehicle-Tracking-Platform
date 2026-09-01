import { ArrowDown, ArrowUp, MapPin, Minus } from 'lucide-react';

import { formatIn, formatPct } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { DetectionLocation, LocationId } from '@/types/analytics';

interface TopDetectionLocationsPanelProps {
  locations: DetectionLocation[];
  onSelectLocation: (id: LocationId) => void;
}

const rankTone = [
  'bg-accent-red/15 text-[#ff8b96] ring-accent-red/40',
  'bg-accent-orange/15 text-[#f7b95f] ring-accent-orange/40',
  'bg-accent-yellow/15 text-[#eddb6a] ring-accent-yellow/40',
];

const trendIcon = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const trendTone = { up: 'text-accent-green', down: 'text-accent-red', flat: 'text-[#6d7f9e]' } as const;

/** Ranked list: Gift City Road, S.G. Highway, Shahibaug, Naranpura, Vadodara City Center. */
export function TopDetectionLocationsPanel({ locations, onSelectLocation }: TopDetectionLocationsPanelProps) {
  const max = Math.max(1, locations[0]?.detections ?? 1);

  return (
    <Panel
      title="Top Detection Locations"
      action={<span className="tnum text-3xs text-ink-dim">ranked by detections</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col justify-between gap-px overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {locations.length === 0 ? (
        <div className="grid h-full place-items-center text-[10px] text-ink-dim">No locations in this filter.</div>
      ) : (
        locations.map((location) => {
          const Trend = trendIcon[location.trend];
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => onSelectLocation(location.locationId)}
              className="flex items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[5px] text-left transition-colors hover:border-edge hover:bg-panel-hover"
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
                  <span className="truncate text-[10.5px] font-semibold text-[#dbe6f5]">{location.name}</span>
                  <span className="truncate text-[8.5px] text-[#6d7f9e]">· {location.city}</span>
                </span>
                <span className="mt-[3px] block h-[3.5px] overflow-hidden rounded-full bg-[#14243c]">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all duration-500"
                    style={{ width: `${(location.detections / max) * 100}%` }}
                  />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-none">
                <span className="flex items-center gap-1">
                  <Trend size={10} strokeWidth={2.4} className={trendTone[location.trend]} />
                  <span className="tnum text-[11px] font-bold text-white">{formatIn(location.detections)}</span>
                </span>
                <span className="tnum mt-[2px] text-[7.5px] text-[#6d82a3]">
                  {formatPct(location.share, 0)} · {location.peak}
                </span>
              </span>
            </button>
          );
        })
      )}
    </Panel>
  );
}
