import type { Severity } from '@/types';
import type { AlertResponseEvent, AlertStatus } from '@/types/alerts';

import { eventTone, severityChip, statusChip, statusLabel } from './tones';

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.07em] ring-1 ${severityChip[severity]}`}
    >
      {severity}
    </span>
  );
}

export function StatusChip({ status, className = '' }: { status: AlertStatus; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.07em] ring-1 ${statusChip[status]} ${className}`}
    >
      {status === 'new' ? <span className="h-1 w-1 rounded-full bg-accent-blue animate-pulse-dot" /> : null}
      {statusLabel[status]}
    </span>
  );
}

export function ConfidenceBar({ value, barClass }: { value: number; barClass: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-[3px] w-[52px] overflow-hidden rounded-full bg-[#14243c]">
        <span
          className={`block h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="tnum text-[9px] font-semibold text-[#9fb0cc]">{value.toFixed(1)}%</span>
    </span>
  );
}

/** One row inside a response log (shared by the timeline panel and the details panel). */
export function TimelineRow({
  event,
  isLast,
}: {
  event: AlertResponseEvent;
  isLast: boolean;
}) {
  const tone = eventTone[event.tone];
  return (
    <li className="relative flex gap-2.5 pb-2.5 last:pb-0.5">
      {!isLast ? <span className="absolute left-[5px] top-[13px] bottom-0 w-px bg-edge" /> : null}
      <span
        className={`mt-[3px] h-[11px] w-[11px] shrink-0 rounded-full ring-2 ${
          event.pending ? 'bg-transparent border border-dashed border-[#3d5078]' : `${tone.dot} ring-2`
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[10px] font-semibold ${event.pending ? 'text-[#8ea1c0]' : 'text-[#dbe6f5]'}`}>
            {event.label}
          </span>
          <span className="tnum shrink-0 text-[8.5px] text-[#6d7f9e]">{event.ago}</span>
        </div>
        <div className="mt-px text-[9px] leading-[12.5px] text-[#94a5c2]">{event.detail}</div>
        <div className="mt-px flex items-center justify-between text-[8.5px]">
          <span className={`font-medium ${tone.text}`}>{event.actor}</span>
          <span className="tnum text-[#6d7f9e]">{event.time}</span>
        </div>
      </div>
    </li>
  );
}
