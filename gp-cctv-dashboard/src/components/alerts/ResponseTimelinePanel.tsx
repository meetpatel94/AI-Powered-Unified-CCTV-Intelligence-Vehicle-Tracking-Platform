import { History } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { AlertRecord } from '@/types/alerts';

import { TimelineRow } from './AlertChips';

interface ResponseTimelinePanelProps {
  alert: AlertRecord | null;
  onOpen: (alert: AlertRecord) => void;
}

/** Right rail: response log for the selected incident (falls back to the newest alert). */
export function ResponseTimelinePanel({ alert, onOpen }: ResponseTimelinePanelProps) {
  return (
    <Panel
      title="Response Timeline"
      tools={
        <span className="flex items-center gap-1 text-3xs text-ink-dim">
          <History size={9} />
          auto log
        </span>
      }
      action={
        alert ? (
          <button type="button" onClick={() => onOpen(alert)} className="link-action tnum">
            {alert.id}
          </button>
        ) : undefined
      }
      className="h-full min-h-0"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1"
    >
      {alert ? (
        <>
          <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-edge-soft pb-1.5">
            <span className="min-w-0 truncate text-[12px] font-semibold text-[#dbe6f5]">
              {alert.title} · <span className="tnum tracking-[0.03em] text-white">{alert.subject}</span>
            </span>
            <span className="tnum shrink-0 text-[10.5px] text-[#6d7f9e]">{alert.camera}</span>
          </div>
          <ol>
            {alert.timeline.map((event, index) => (
              <TimelineRow key={event.id} event={event} isLast={index === alert.timeline.length - 1} />
            ))}
          </ol>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#55668a]">
            {alert.timeline.filter((event) => !event.pending).length} logged ·{' '}
            {alert.timeline.filter((event) => event.pending).length} pending · SLA clock visible in details
          </p>
        </>
      ) : (
        <p className="text-[12px] text-ink-dim">No incident selected — click an alert card to trace its response log.</p>
      )}
    </Panel>
  );
}
