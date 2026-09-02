import { useEffect } from 'react';
import { Brain, Download, FileText, X } from 'lucide-react';

import { formatIn, formatPct } from '@/components/analytics/chartMath';
import type { AnalyticsSnapshot } from '@/types/analytics';

interface DetailedReportDrawerProps {
  snapshot: AnalyticsSnapshot | null;
  onClose: () => void;
  onExport: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">{label}</div>
      <div className="mt-[2px] truncate text-[12.5px] font-medium text-[#dbe6f5]">{value}</div>
    </div>
  );
}

/** Slide-over operational briefing generated from the current analytics snapshot. */
export function DetailedReportDrawer({ snapshot, onClose, onExport }: DetailedReportDrawerProps) {
  useEffect(() => {
    if (!snapshot) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [snapshot, onClose]);

  if (!snapshot) return null;

  const { kpis, anpr, locations, eventTypes, vehicleTypes, unusual, insights } = snapshot;
  const topEvent = [...eventTypes].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close detailed report"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[min(540px,94vw)] animate-drawer-in flex-col border-l border-edge bg-[#0a1120] shadow-[0_0_40px_rgba(0,0,0,0.65)]">
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-purple/40 bg-accent-purple/15">
              <Brain size={13} className="text-accent-purple" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-bold uppercase tracking-[0.06em] text-white">
                Intelligence Briefing
              </div>
              <div className="tnum text-[11px] text-ink-dim">
                gp-intel-v2.4 · 01 Sep 2026 · {snapshot.generatedAt}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          <section className="rounded-md border border-accent-purple/30 bg-[#160c22] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#d0a4f7]">
              <FileText size={11} />
              Scope
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <Field label="Date range" value={snapshot.rangeLabel} />
              <Field label="Location" value={snapshot.locationLabel} />
              <Field label="Camera" value={snapshot.cameraLabel} />
              <Field label="Window" value={snapshot.windowNote} />
            </div>
          </section>

          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Operational snapshot</h3>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <Field label="Vehicles detected" value={formatIn(kpis.vehicles)} />
              <Field label="ANPR reads" value={formatIn(kpis.anpr)} />
              <Field label="AI events" value={formatIn(kpis.events)} />
              <Field label="Watchlist matches" value={`${formatIn(kpis.watchlist)} · ${kpis.watchlistCritical} critical`} />
              <Field label="Active cameras" value={`${formatIn(kpis.cameras)} / ${formatIn(kpis.fleet)}`} />
              <Field label="ANPR confidence" value={`${anpr.confidence.toFixed(1)}% · ${formatIn(anpr.unreadable)} unreadable`} />
            </div>
          </section>

          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Narrative</h3>
            <p className="mt-1.5 rounded-md border border-edge bg-[#0c1424] px-3 py-2 text-[12.5px] leading-[16px] text-[#b9c7dd]">
              Across {snapshot.locationLabel.toLowerCase()}, the desk processed {formatIn(kpis.vehicles)} vehicle
              detections and {formatIn(kpis.anpr)} ANPR reads ({formatPct(kpis.anprShare)} read rate). Peak load sits at{' '}
              {snapshot.vehicleTrendUnit === 'hour' ? `${snapshot.peakLabel}:00` : snapshot.peakLabel} with{' '}
              {formatIn(snapshot.peakValue)} detections.{' '}
              {locations[0]
                ? `${locations[0].name}, ${locations[0].city} remains the highest-yield location.`
                : 'The selected corridor has no ranked locations in this filter.'}{' '}
              {topEvent ? `${topEvent.label} leads AI events (${formatIn(topEvent.value)}).` : ''} Watchlist load is{' '}
              {formatIn(kpis.watchlist)} with {kpis.watchlistCritical} critical flags requiring operator action.
            </p>
          </section>

          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Key insights</h3>
            <ol className="mt-1.5 space-y-1.5">
              {insights.map((card) => (
                <li key={card.id} className="rounded-md border border-edge bg-[#0c1424] px-3 py-2">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#8ea1c0]">{card.kicker}</div>
                  <div className="mt-[2px] text-[13px] font-bold text-white">
                    {card.title}
                    <span className="tnum ml-2 text-accent-cyan">{card.metric}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-[14px] text-[#8ea1c0]">{card.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Vehicle mix</h3>
            <ul className="mt-1.5 space-y-1">
              {vehicleTypes.map((slice) => (
                <li key={slice.id} className="flex items-center justify-between rounded-[4px] border border-edge bg-[#0c1424] px-2.5 py-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-[#c3cfe2]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: slice.color }} />
                    {slice.label}
                  </span>
                  <span className="tnum text-[12.5px] font-bold text-white">{formatIn(slice.value)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Top locations</h3>
            <ol className="mt-1.5 space-y-1">
              {locations.map((location) => (
                <li key={location.id} className="flex items-center justify-between text-[12px]">
                  <span className="text-[#c3cfe2]">
                    {location.rank}. {location.name}
                    <span className="text-[#6d82a3]"> · {location.city}</span>
                  </span>
                  <span className="tnum font-bold text-white">{formatIn(location.detections)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-3 pb-1">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Unusual activity</h3>
            {unusual.length === 0 ? (
              <p className="mt-1.5 text-[12px] text-ink-dim">None in the current filter.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {unusual.map((event) => (
                  <li key={event.id} className="rounded-md border border-edge bg-[#0c1424] px-2.5 py-1.5 text-[12px] leading-[14px] text-[#c3cfe2]">
                    <span className="tnum mr-1.5 font-semibold text-[#8ea1c0]">{event.time}</span>
                    {event.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-edge px-3.5 py-2.5">
          <button
            type="button"
            onClick={onExport}
            className="flex h-[28px] flex-1 items-center justify-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-[12px] font-semibold text-white transition-all hover:brightness-110"
          >
            <Download size={11} />
            Export briefing CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[28px] flex-1 items-center justify-center rounded-[5px] border border-edge bg-panel text-[12px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
