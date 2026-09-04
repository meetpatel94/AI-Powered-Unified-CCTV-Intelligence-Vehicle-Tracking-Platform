import { Panel } from '@/components/common/Panel';
import type { WatchlistSummarySlice } from '@/types/watchlist';

const SIZE = 92;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/** Right rail bottom: donut split of entries by entity type. */
export function WatchlistSummaryPanel({ slices = [] }: { slices?: WatchlistSummarySlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  /* Precompute dash offsets per render (live data arrives as new arrays). */
  const segments = slices.reduce<Array<WatchlistSummarySlice & { offset: number }>>((acc, slice) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + (previous.percent / 100) * CIRC : 0;
    acc.push({ ...slice, offset });
    return acc;
  }, []);

  return (
    <Panel
      title="Watchlist Summary"
      action={<span className="tnum text-3xs text-ink-dim">{total} entities</span>}
      className="shrink-0"
      bodyClassName="flex items-center gap-3 px-3 pb-3 pt-1"
    >
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#111c30" strokeWidth={STROKE} />
          {segments.map((slice) => {
            const len = (slice.percent / 100) * CIRC;
            return (
              <circle
                key={slice.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-slice.offset}
                style={{ filter: `drop-shadow(0 0 5px ${slice.color}55)` }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-tight">
            <div className="tnum text-[16px] font-bold text-white">{total}</div>
            <div className="text-[9.5px] uppercase tracking-wide text-[#6d7f9e]">Entries</div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-[8px]">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: slice.color, boxShadow: `0 0 6px ${slice.color}70` }}
            />
            <span className="flex-1 truncate text-[#c3cfe2]">{slice.label}</span>
            <span className="tnum shrink-0 text-[#8fa0bd]">
              {slice.count} ({slice.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
