import { ScanLine } from 'lucide-react';

import { Panel, ViewAll } from '@/components/common/Panel';
import { useAnprFeed } from '@/hooks/useAnprFeed';

/** Continuously updating plate-read ticker (simulated `anpr:hit` stream). */
export function AnprFeedPanel() {
  const hits = useAnprFeed();

  return (
    <Panel
      title="Live ANPR OCR Feed"
      action={<ViewAll label="Open Log" />}
      tools={
        <span className="flex items-center gap-1 text-3xs text-accent-green">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          streaming
        </span>
      }
      className="min-h-0 flex-1"
      bodyClassName="flex min-h-0 flex-col px-2 pb-2 pt-0.5"
    >
      <div className="mb-1 flex items-center gap-1 px-1 text-[8px] uppercase tracking-[0.08em] text-[#6d82a3]">
        <ScanLine size={9} />
        <span className="w-[78px]">Plate</span>
        <span className="w-[42px]">Camera</span>
        <span className="flex-1">Time</span>
        <span>Conf.</span>
      </div>

      <ul className="min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-0.5">
        {hits.map((hit, index) => (
          <li
            key={hit.id}
            className={`flex items-center gap-1 rounded-[3px] border px-1.5 py-[4px] text-[9.5px] transition-colors ${
              hit.watchlist
                ? 'border-accent-red/60 bg-accent-red/10'
                : 'border-edge-soft bg-[#0c1424] hover:border-edge-strong'
            } ${index === 0 ? 'ring-1 ring-accent-cyan/30' : ''}`}
          >
            <span
              className={`w-[78px] font-semibold tracking-wide ${
                hit.watchlist ? 'text-[#ff8b96]' : 'text-white'
              }`}
            >
              {hit.plate}
            </span>
            <span className="w-[42px] text-[#8ea1c0]">{hit.camera}</span>
            <span className="tnum flex-1 text-[#6d82a3]">{hit.time}</span>
            <span
              className={`tnum text-[9px] font-medium ${
                hit.confidence >= 95
                  ? 'text-accent-green'
                  : hit.confidence >= 90
                    ? 'text-accent-cyan'
                    : 'text-accent-orange'
              }`}
            >
              {hit.confidence.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
