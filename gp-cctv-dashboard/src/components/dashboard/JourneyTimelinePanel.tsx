import { Panel } from '@/components/common/Panel';
import type { JourneyStop } from '@/types';

function StopCard({ stop }: { stop: JourneyStop }) {
  return (
    <article
      className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-[5px] border bg-[#0d1626] ${
        stop.alert ? 'border-accent-red/70 shadow-[0_0_16px_-6px_rgba(239,68,68,0.85)]' : 'border-edge'
      }`}
    >
      <div className="px-2 pb-1 pt-1.5">
        <div className="tnum text-[11.5px] text-[#8ea1c0]">{stop.time}</div>
        <div className="text-[13px] font-bold leading-tight tracking-wide text-white">{stop.cameraCode}</div>
        <div className="mt-[1px] truncate text-[11px] leading-[12px] text-[#8ea1c0]">{stop.road}</div>
        <div className="truncate text-[11px] leading-[12px] text-[#6d82a3]">{stop.city}</div>
      </div>

      <div className="relative mx-1.5 mb-1.5 mt-0.5 min-h-[52px] flex-1 overflow-hidden rounded-[3px] border border-edge-soft bg-black">
        <img src={stop.thumbnail} alt={`${stop.cameraCode} sighting`} className="h-full w-full object-cover" />
        {stop.alert && (
          <>
            <div className="absolute inset-0 bg-accent-red/20 mix-blend-screen" />
            <div className="absolute inset-0 ring-1 ring-inset ring-accent-red/60" />
            <span className="absolute right-1 top-1 rounded-[2px] bg-accent-red px-1 py-px text-[9.5px] font-bold uppercase tracking-wider text-white">
              Alert
            </span>
          </>
        )}
      </div>
    </article>
  );
}

/** "HH:MM[:SS]" clock strings → minutes between them (handles midnight rollover). */
function spanMinutesBetween(from: string, to: string): number {
  const parse = (t: string) => {
    const [h, m, s] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
  };
  const diff = parse(to) - parse(from);
  return Math.round(diff < 0 ? diff + 24 * 60 : diff);
}

/** Chronological camera-to-camera reconstruction of the tracked vehicle's route. */
export function JourneyTimelinePanel({
  stops = [],
  plate = null,
  spanLabel,
}: {
  stops?: JourneyStop[];
  plate?: string | null;
  spanLabel?: string | null;
}) {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const span =
    spanLabel ??
    (first && last ? `${spanMinutesBetween(first.time, last.time)}m span` : '—');

  return (
    <Panel
      title="Vehicle Journey Timeline"
      tools={
        <span className="text-3xs text-ink-dim">
          <span className="font-semibold tracking-wide text-[#9fb4d6]">{plate ?? '—'}</span> · {stops.length} sighting
          {stops.length === 1 ? '' : 's'} · {span}
        </span>
      }
      className="h-full"
      bodyClassName="flex flex-col px-3 pb-2.5 pt-1"
    >
      {stops.length === 0 ? (
        <div className="grid min-h-[170px] flex-1 place-items-center rounded-[5px] border border-dashed border-edge bg-[#071120] px-4 text-center">
          <div>
            <div className="text-[13px] font-semibold text-white">No vehicle journeys</div>
            <div className="mt-1 text-[11.5px] text-ink-dim">The backend has not reported cross-camera journey points.</div>
          </div>
        </div>
      ) : (
        <>
      {/* node rail */}
      <div className="relative mb-1.5 h-[18px] shrink-0">
        <div className="absolute left-[12%] right-[38%] top-[9px] h-px border-t border-dashed border-[#2c4468]" />
        <div className="absolute left-[62%] right-[12%] top-[9px] h-px border-t border-dashed border-accent-red/70" />
        <div className="flex h-full items-center justify-around">
          {stops.map((stop) => (
            <span
              key={stop.step}
              className={`tnum relative grid h-[17px] w-[17px] place-items-center rounded-full text-[11px] font-bold text-white ${
                stop.alert ? 'bg-accent-red' : 'bg-[#17a349]'
              }`}
              style={{
                boxShadow: stop.alert ? '0 0 12px rgba(239,68,68,0.85)' : '0 0 10px rgba(23,163,73,0.6)',
              }}
            >
              {stop.step}
            </span>
          ))}
        </div>
      </div>

      {/* sighting cards */}
      <div className="flex min-h-0 flex-1 items-stretch gap-2.5">
        {stops.map((stop) => (
          <StopCard key={stop.step} stop={stop} />
        ))}
      </div>
      </>
      )}
    </Panel>
  );
}
