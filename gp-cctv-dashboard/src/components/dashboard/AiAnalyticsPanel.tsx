import { Panel, ViewAll } from '@/components/common/Panel';
import { analyticsBars } from '@/data/mockData';
import type { AnalyticsBar } from '@/types';

const MAX = 20000;
const TICKS = [20000, 15000, 10000, 5000, 0];

const formatTick = (v: number) => (v === 0 ? '0' : `${v / 1000}k`);

/** Today's edge-AI detection counts by object class (falls back to mock bars). */
export function AiAnalyticsPanel({ bars = analyticsBars }: { bars?: AnalyticsBar[] }) {
  return (
    <Panel
      title="AI Analytics (Today)"
      action={<ViewAll label="View Report" />}
      className="h-full"
      bodyClassName="px-3 pb-2 pt-1"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 gap-1.5">
          {/* y axis */}
          <div className="flex w-[22px] shrink-0 flex-col justify-between pb-[18px] pt-[14px] text-right text-[10px] tabular-nums text-[#6d82a3]">
            {TICKS.map((tick) => (
              <span key={tick}>{formatTick(tick)}</span>
            ))}
          </div>

          {/* plot */}
          <div className="relative min-w-0 flex-1">
            {/* gridlines */}
            <div className="absolute inset-x-0 bottom-[18px] top-[14px] flex flex-col justify-between">
              {TICKS.map((tick) => (
                <div key={tick} className="h-px w-full" style={{ background: '#14243c' }} />
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-[18px] top-[14px] flex items-end justify-around gap-3 px-1">
              {bars.map((bar) => {
                const height = `${Math.max(3, (bar.value / MAX) * 100)}%`;
                return (
                  <div key={bar.id} className="flex h-full flex-1 flex-col justify-end">
                    <span className="tnum mb-[3px] text-center text-[11.5px] font-semibold leading-none text-[#e2eaf7]">
                      {bar.value.toLocaleString('en-IN')}
                    </span>
                    <div
                      className="mx-auto w-[52%] shrink-0 rounded-t-[2px] transition-all duration-500"
                      style={{
                        height,
                        background: `linear-gradient(180deg, ${bar.color} 0%, ${bar.color}cc 60%, ${bar.color}77 100%)`,
                        boxShadow: `0 0 14px -3px ${bar.glow}`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* x axis */}
            <div className="absolute inset-x-0 bottom-0 flex h-[18px] items-center justify-around gap-3 px-1">
              {bars.map((bar) => (
                <span key={bar.id} className="flex-1 truncate text-center text-[10.5px] text-[#8ea1c0]">
                  {bar.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
