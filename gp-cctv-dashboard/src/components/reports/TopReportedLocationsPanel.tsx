import { MapPin } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { topReportedLocations } from '@/data/reportsData';

const toneColor: Record<string, string> = {
  red: '#ef4444',
  orange: '#f59e0b',
  blue: '#2f7dff',
  cyan: '#22d3ee',
};

/** REPORT ANALYTICS · ranked list of the most reported locations. */
export function TopReportedLocationsPanel() {
  return (
    <Panel
      title="Top Reported Locations"
      tools={<span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">30 days</span>}
      className="h-full"
      bodyClassName="flex flex-col justify-center gap-1 px-3.5 pb-3"
    >
      {topReportedLocations.map((location) => {
        const color = toneColor[location.tone];
        return (
          <div
            key={location.rank}
            className="group rounded-[5px] px-1.5 py-1.5 transition-colors hover:bg-panel-hover/60"
            title={`${location.reports} reports · dominant: ${location.dominantType}`}
          >
            <div className="flex items-center gap-2">
              <span
                className="tnum grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[4px] border font-mono text-3xs font-bold"
                style={{ borderColor: `${color}44`, backgroundColor: `${color}14`, color }}
              >
                {location.rank}
              </span>
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="truncate text-[12.5px] font-medium text-ink">{location.location}</span>
                <span className="flex shrink-0 items-center gap-0.5 text-3xs uppercase tracking-[0.06em] text-ink-faint">
                  <MapPin size={9} />
                  {location.city}
                </span>
              </span>
              <span className="tnum shrink-0 font-mono text-[12px] font-bold text-white">{location.reports}</span>
            </div>
            <div className="ml-7 mt-1 flex items-center gap-2">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#111c30]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${location.share}%`,
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    boxShadow: `0 0 6px -1px ${color}`,
                  }}
                />
              </div>
              <span className="w-[118px] shrink-0 truncate text-right text-3xs text-ink-faint">
                {location.dominantType}
              </span>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
