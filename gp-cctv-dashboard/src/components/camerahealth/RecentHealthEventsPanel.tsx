import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { toneInk } from '@/components/camerahealth/healthTones';
import { eventKindMeta } from '@/data/cameraHealthData';

import type { HealthEvent } from '@/types/cameraHealth';

type KindFilter = 'all' | HealthEvent['kind'];

const KIND_ORDER: HealthEvent['kind'][] = ['disconnected', 'reconnecting', 'poor-signal', 'recovered', 'codec', 'processing'];

/**
 * RECENT HEALTH EVENTS — ingest/edge timeline: disconnects, reconnect
 * attempts, signal degradation, recoveries and codec / AI processing events.
 */
export function RecentHealthEventsPanel({
  events,
  onSelectCamera,
  selectedId,
}: {
  events: HealthEvent[];
  onSelectCamera: (id: string) => void;
  selectedId: string | null;
}) {
  const [kind, setKind] = useState<KindFilter>('all');
  const counts = KIND_ORDER.reduce<Record<string, number>>((acc, id) => {
    acc[id] = events.filter((event) => event.kind === id).length;
    return acc;
  }, {});

  const shown = kind === 'all' ? events : events.filter((event) => event.kind === kind);

  return (
    <Panel
      title="Recent Health Events"
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col"
      tools={<span className="tnum font-mono text-[11px] text-ink-faint">{shown.length} events · last 60 min</span>}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-2.5 pb-1.5">
        <button
          type="button"
          onClick={() => setKind('all')}
          className={`rounded-[3px] border px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.06em] transition-colors ${
            kind === 'all' ? 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]' : 'border-edge bg-[#0c1424] text-ink-faint hover:text-white'
          }`}
        >
          All {events.length}
        </button>
        {KIND_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(kind === id ? 'all' : id)}
            className={`tnum rounded-[3px] border px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              kind === id ? 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]' : 'border-edge bg-[#0c1424] text-ink-faint hover:text-white'
            }`}
          >
            {eventKindMeta[id].label} {counts[id]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        <ol className="relative space-y-[6px] border-l border-edge-soft pl-3">
          {shown.map((event) => {
            const Icon = event.icon;
            const color = toneInk[event.tone];
            const isSelected = event.cameraId === selectedId;
            return (
              <li key={event.id} className="relative">
                <span
                  className="absolute top-[5px] -left-[15px] grid h-[9px] w-[9px] place-items-center rounded-full border"
                  style={{ borderColor: `${color}88`, backgroundColor: '#0b1222' }}
                >
                  <span className="h-[4px] w-[4px] rounded-full" style={{ backgroundColor: color }} />
                </span>

                <button
                  type="button"
                  onClick={() => onSelectCamera(event.cameraId)}
                  className={`w-full rounded-[4px] border px-2 py-1 text-left transition-colors ${
                    isSelected ? 'border-edge-strong bg-panel-hover' : 'border-transparent hover:border-edge hover:bg-panel-hover/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon size={10} style={{ color }} className="shrink-0" />
                    <span className="text-[11.5px] font-semibold uppercase tracking-[0.07em]" style={{ color }}>
                      {eventKindMeta[event.kind].label}
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold text-white">{event.cameraId}</span>
                    <span className="truncate text-[11px] text-ink-dim">{event.location}</span>
                    <span className="tnum ml-auto shrink-0 font-mono text-[11px] text-ink-faint">{event.time}</span>
                    {event.autoResolved ? (
                      <span className="flex shrink-0 items-center gap-[2px] rounded-[3px] border border-accent-green/40 bg-[#0b2e26] px-1 text-[10px] font-semibold text-[#6fe0b0]">
                        <CheckCircle2 size={8} />
                        auto
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-[2px] block text-[11px] leading-[12.5px] text-ink-dim">{event.detail}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}
