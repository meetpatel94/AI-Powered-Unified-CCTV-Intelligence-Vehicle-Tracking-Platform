import { Panel } from '@/components/common/Panel';
import { alertsByWatchlist } from '@/data/watchlistData';

const MAX = 6;
const TICKS = [6, 4, 2, 0];

/** Bottom row left: active alerts raised per watchlist category. */
export function AlertsByWatchlistPanel() {
  return (
    <Panel
      title="Alerts by Watchlist"
      action={<span className="tnum text-3xs text-ink-dim">last 24 hrs · 18 total</span>}
      className="h-full min-h-0"
      bodyClassName="overflow-y-auto px-3 pb-3 pt-1"
    >
      <div className="flex h-full min-h-0 gap-1.5">
        <div className="flex w-[18px] shrink-0 flex-col justify-between pb-[16px] pt-[12px] text-right text-[10px] tabular-nums text-[#6d82a3]">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-[16px] top-[12px] flex flex-col justify-between">
            {TICKS.map((tick) => (
              <div key={tick} className="h-px w-full" style={{ background: '#14243c' }} />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-[16px] top-[12px] flex items-end justify-around gap-2 px-1">
            {alertsByWatchlist.map((bar) => {
              const height = `${Math.max(2, (bar.value / MAX) * 100)}%`;
              return (
                <div key={bar.id} className="flex h-full flex-1 flex-col justify-end">
                  <span className="tnum mb-[3px] text-center text-[11px] font-semibold leading-none text-[#e2eaf7]">
                    {bar.value}
                  </span>
                  <div
                    className="mx-auto w-[54%] shrink-0 rounded-t-[2px]"
                    style={{
                      height,
                      background: `linear-gradient(180deg, ${bar.color} 0%, ${bar.color}cc 60%, ${bar.color}77 100%)`,
                      boxShadow: `0 0 12px -3px ${bar.color}`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[16px] items-center justify-around gap-2 px-1">
            {alertsByWatchlist.map((bar) => (
              <span key={bar.id} className="flex-1 truncate text-center text-[10px] text-[#8ea1c0]">
                {bar.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
