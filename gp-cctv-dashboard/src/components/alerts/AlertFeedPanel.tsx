import { Camera, ChevronRight, MapPin, Maximize2, Radio, ShieldCheck } from 'lucide-react';

import type { Severity } from '@/types';
import type { AlertRecord } from '@/types/alerts';

import { ConfidenceBar, SeverityChip, StatusChip } from './AlertChips';
import { severityBar, severityText } from './tones';

export type AlertSortMode = 'newest' | 'oldest' | 'severity';

const sortTone: Record<AlertSortMode, string> = {
  newest: 'text-accent-cyan',
  oldest: 'text-accent-cyan',
  severity: 'text-accent-orange',
};

interface AlertCardProps {
  alert: AlertRecord;
  selected: boolean;
  onSelect: (alert: AlertRecord) => void;
  onQuickResolve: (id: string) => void;
}

/** Dense one-glance alert card: severity, plate/object, camera, location, conf, status. */
export function AlertCard({ alert, selected, onSelect, onQuickResolve }: AlertCardProps) {
  const Icon = alert.icon;
  const resolved = alert.status === 'resolved';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(alert)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(alert);
        }
      }}
      className={`group relative flex cursor-pointer gap-2.5 overflow-hidden rounded-[6px] border border-l-[3px] bg-[#0c1424] px-2.5 py-2 text-left transition-all duration-150 hover:border-edge-strong hover:bg-panel-hover focus:outline-none ${
        selected
          ? 'border-accent-blue/60 border-l-[3px] bg-[#101d38] ring-1 ring-accent-blue/50 shadow-glow'
          : 'border-edge-soft'
      } ${severityBorder(alert.severity, resolved)}`}
    >
      {/* snapshot thumbnail */}
      <div className="relative h-[52px] w-[78px] shrink-0 overflow-hidden rounded-[4px] border border-edge bg-black">
        <img
          src={alert.thumbnail}
          alt={`${alert.id} snapshot`}
          loading="lazy"
          className={`h-full w-full object-cover ${resolved ? 'opacity-70 saturate-50' : 'transition-transform duration-300 group-hover:scale-[1.06]'}`}
        />
        <span className="tnum absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/95 to-transparent px-1 pt-2 pb-[2px] text-[7px] font-semibold tracking-wide text-[#9fb0cc]">
          {alert.camera}
        </span>
        {alert.plate ? (
          <span className="absolute right-0.5 top-0.5 rounded-[2px] bg-[#083344]/90 px-1 text-[7px] font-bold text-[#67e8f9]">
            ANPR
          </span>
        ) : null}
      </div>

      {/* main */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon size={11} strokeWidth={2.1} className={`shrink-0 ${severityText[alert.severity]}`} />
          <span className={`truncate text-[10.5px] font-bold uppercase tracking-[0.06em] ${severityText[alert.severity]}`}>
            {alert.title}
          </span>
          <SeverityChip severity={alert.severity} />
          {alert.watchlistList ? (
            <span className="hidden truncate rounded-[3px] bg-[#210e30] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-[#d0a4f7] ring-1 ring-accent-purple/40 xl:inline">
              {alert.watchlistList}
            </span>
          ) : null}
          <span className="tnum ml-auto shrink-0 text-[9px] text-ink-dim">{alert.time}</span>
        </div>

        <div className="mt-[3px] flex items-baseline gap-2">
          <span
            className={`tnum truncate text-[13px] font-bold leading-[15px] tracking-[0.04em] ${
              resolved ? 'text-[#9fb0cc]' : 'text-white'
            }`}
          >
            {alert.subject}
          </span>
          {alert.objectLabel ? (
            <span className="truncate text-[9.5px] text-[#8ea1c0]">{alert.objectLabel}</span>
          ) : null}
          {resolved ? null : (
            <span className="tnum ml-auto hidden shrink-0 text-[8.5px] text-[#6d7f9e] group-hover:inline">
              {alert.id}
            </span>
          )}
        </div>

        <div className="mt-[4px] flex items-center gap-2.5 text-[9px] text-[#94a5c2]">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={9} className="shrink-0 text-accent-cyan" />
            <span className="truncate">
              {alert.location}, {alert.city}
            </span>
          </span>
          {alert.speedKph ? (
            <span className="tnum hidden shrink-0 items-center gap-0.5 text-[#f7b95f] 2xl:flex">
              <GaugeLike /> {alert.speedKph}/{alert.limitKph} km/h
            </span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <ConfidenceBar value={alert.confidence} barClass={severityBar[alert.severity]} />
            <StatusChip status={alert.status} />
          </span>
        </div>
      </div>

      {/* right rail: age + quick actions */}
      <div className="flex w-[72px] shrink-0 flex-col items-end justify-between border-l border-edge-soft pl-2">
        <span className="tnum text-[9px] font-medium text-[#8ea1c0]">{alert.ago}</span>
        <div className="flex items-center gap-1">
          {!resolved && alert.status === 'new' ? (
            <button
              type="button"
              title="Quick resolve"
              onClick={(event) => {
                event.stopPropagation();
                onQuickResolve(alert.id);
              }}
              className="grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#0b2e26] text-[#6fe0b0] opacity-0 transition-all hover:border-accent-green/60 group-hover:opacity-100"
            >
              <ShieldCheck size={11} />
            </button>
          ) : null}
          <span
            className={`grid h-[20px] w-[20px] place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-[#8ea3c4] transition-colors ${
              selected ? 'text-accent-cyan' : 'group-hover:text-white'
            }`}
          >
            <ChevronRight size={11} className={selected ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </span>
        </div>
      </div>

      {selected ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/70 to-transparent" />
      ) : null}
    </div>
  );
}

function severityBorder(severity: Severity, resolved: boolean): string {
  if (resolved) return 'border-l-accent-green';
  switch (severity) {
    case 'critical':
      return 'border-l-accent-red';
    case 'high':
      return 'border-l-accent-orange';
    case 'medium':
      return 'border-l-accent-yellow';
    default:
      return 'border-l-accent-blue';
  }
}

/** Small inline gauge glyph to keep the traffic-metric row light-weight. */
function GaugeLike() {
  return (
    <svg viewBox="0 0 12 12" className="h-[10px] w-[10px]" aria-hidden="true">
      <path d="M2 9.5a5.4 5.4 0 1 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 8.4 8.3 4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

interface AlertFeedPanelProps {
  alerts: AlertRecord[];
  totalCount: number;
  selectedId: string | null;
  sort: AlertSortMode;
  onSort: (mode: AlertSortMode) => void;
  onSelect: (alert: AlertRecord) => void;
  onQuickResolve: (id: string) => void;
  onReset: () => void;
}

/** Main workspace left: the dense alert feed. */
export function AlertFeedPanel({
  alerts,
  totalCount,
  selectedId,
  sort,
  onSort,
  onSelect,
  onQuickResolve,
  onReset,
}: AlertFeedPanelProps) {
  return (
    <section className="panel flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1.5 pt-2.5">
        <h2 className="panel-title">
          Alert Feed
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-dim">
            showing {alerts.length} of {totalCount} events · shift 06:00–14:00
          </span>
        </h2>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-3xs text-accent-green">
            <Radio size={10} className="animate-pulse-dot" /> live ingest
          </span>
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => onSort(event.target.value as AlertSortMode)}
              className={`h-[24px] appearance-none rounded-[4px] border border-edge bg-[#0c1424] pl-2 pr-6 text-[10px] font-medium outline-none transition-colors hover:border-edge-strong ${sortTone[sort]}`}
            >
              <option value="newest">Newest first</option>
              <option value="severity">Severity first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronRight size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rotate-90 text-[#6d7f9e]" />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5 pt-0.5">
        {alerts.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <Camera size={26} strokeWidth={1.4} className="mx-auto mb-2 text-[#3d5078]" />
              <p className="text-[11px] text-ink-dim">No alerts match the current filters.</p>
              <button type="button" onClick={onReset} className="link-action mt-1.5">
                Reset filters
              </button>
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              selected={alert.id === selectedId}
              onSelect={onSelect}
              onQuickResolve={onQuickResolve}
            />
          ))
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-edge-soft px-3 py-1.5 text-[8.5px] text-[#55668a]">
        <span className="flex items-center gap-1">
          <Maximize2 size={8} /> click a card to open ALERT DETAILS
        </span>
        <span className="tnum">retention 90 d · archive gp-evidence-01 · sha-256 pinned</span>
      </footer>
    </section>
  );
}
