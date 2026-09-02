import { Bell, ExternalLink, ScanSearch, ShieldAlert } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import type { EventTone, RelatedEvent } from '@/types/investigation';

interface RelatedEventsPanelProps {
  events: RelatedEvent[];
  plate: string;
  onOpenEvent: (event: RelatedEvent) => void;
  onOpenEvidence: (sightingId: string) => void;
  onAcknowledge: (eventId: string) => void;
}

const toneRing: Record<EventTone, string> = {
  red: 'border-accent-red/50 bg-[#2a0d13] text-[#ff8b96]',
  orange: 'border-accent-orange/50 bg-[#2b1a06] text-[#f7b95f]',
  yellow: 'border-accent-yellow/50 bg-[#2b2406] text-[#eddb6a]',
  green: 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]',
  blue: 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]',
  purple: 'border-accent-purple/50 bg-[#22103a] text-[#d8b4fe]',
  cyan: 'border-accent-cyan/50 bg-[#083344] text-[#67e8f9]',
};

const toneEdge: Record<EventTone, string> = {
  red: 'border-accent-red/45',
  orange: 'border-accent-orange/40',
  yellow: 'border-accent-yellow/40',
  green: 'border-accent-green/40',
  blue: 'border-accent-blue/40',
  purple: 'border-accent-purple/40',
  cyan: 'border-accent-cyan/40',
};

const severityChip: Record<string, string> = {
  critical: 'bg-accent-red/20 text-[#ff8b96] ring-accent-red/45',
  high: 'bg-accent-orange/20 text-[#f7b95f] ring-accent-orange/45',
  medium: 'bg-accent-yellow/20 text-[#eddb6a] ring-accent-yellow/45',
  info: 'bg-accent-cyan/20 text-[#67e8f9] ring-accent-cyan/45',
};

/** RELATED EVENTS: AI detections raised against the same target vehicle. */
export function RelatedEventsPanel({ events, plate, onOpenEvent, onOpenEvidence, onAcknowledge }: RelatedEventsPanelProps) {
  return (
    <Panel
      title="Related Events"
      tools={
        <span className="tnum text-3xs text-ink-dim">
          {events.length} AI events · {events.filter((event) => event.severity === 'critical').length} critical
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <article
            key={event.id}
            className={`rounded-[5px] border bg-[#0c1424] px-2 py-1.5 transition-colors hover:bg-panel-hover ${toneEdge[event.tone]}`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[4px] border ${toneRing[event.tone]}`}>
                <Icon size={12} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-bold uppercase tracking-[0.05em] text-white">{event.title}</span>
                  <span
                    className={`shrink-0 rounded-[3px] px-1 py-px text-[9.5px] font-bold uppercase tracking-[0.07em] ring-1 ${severityChip[event.severity]}`}
                  >
                    {event.severity}
                  </span>
                  {event.severity === 'critical' ? (
                    <ShieldAlert size={10} className="shrink-0 animate-pulse-dot text-accent-red" />
                  ) : null}
                  <span className="tnum ml-auto shrink-0 text-[10.5px] text-[#7f93b3]">{event.time}</span>
                </div>
                <div className="tnum mt-[2px] flex items-center gap-1.5 text-[11px] text-[#94a5c2]">
                  <span className="font-mono font-semibold text-[#9fc7ff]">{event.cameraId}</span>
                  <span className="truncate">
                    {event.location} · {event.city}
                  </span>
                  <span className="ml-auto shrink-0 rounded-[3px] bg-[#16233a] px-1 text-[10px] text-[#9fb0cc]">{event.alertId}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-[13px] text-[#8ea1c0]">{event.detail}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="tnum truncate rounded-[3px] bg-[#0d1626] px-1.5 py-px text-[10px] text-[#67e8f9] ring-1 ring-edge">
                    {event.metric ?? `${event.confidence.toFixed(1)}% confidence`}
                  </span>
                  <span className="tnum truncate text-[10px] text-[#6d82a3]">{plate}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(event.sightingId)}
                      className="flex h-[19px] items-center gap-1 rounded-[3px] border border-edge bg-[#0d1626] px-1.5 text-[10.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-cyan/60 hover:text-[#67e8f9]"
                    >
                      <ScanSearch size={9} />
                      Evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEvent(event)}
                      className="flex h-[19px] items-center gap-1 rounded-[3px] border border-edge bg-[#0d1626] px-1.5 text-[10.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-blue/60 hover:text-white"
                    >
                      <ExternalLink size={9} />
                      Alert
                    </button>
                    {!event.acknowledged ? (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(event.id)}
                        className="flex h-[19px] items-center gap-1 rounded-[3px] border border-accent-green/45 bg-[#0b2e26] px-1.5 text-[10.5px] font-semibold text-[#6fe0b0] transition-colors hover:border-accent-green/70"
                      >
                        <Bell size={9} />
                        Ack
                      </button>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </Panel>
  );
}
