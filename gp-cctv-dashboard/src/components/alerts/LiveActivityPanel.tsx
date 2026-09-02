import { useEffect, useRef, useState } from 'react';

import { Panel } from '@/components/common/Panel';
import { activityPlates, activityPool, alertStreamTime } from '@/data/alertsData';
import type { ActivityEvent } from '@/types/alerts';

const toneRow: Record<ActivityEvent['tone'], string> = {
  info: 'border-edge-soft bg-[#0c1424] hover:border-edge-strong',
  warning: 'border-accent-orange/35 bg-[#241a08] hover:border-accent-orange/60',
  alert: 'border-accent-red/50 bg-[#2a0d13] hover:border-accent-red/70',
  watchlist: 'border-accent-red/60 bg-[#2a0d13]',
};

const toneIcon: Record<ActivityEvent['tone'], string> = {
  info: 'bg-[#16233a] text-[#8ea1c0] ring-edge-strong',
  warning: 'bg-accent-orange/15 text-accent-orange ring-accent-orange/40',
  alert: 'bg-accent-red/15 text-accent-red ring-accent-red/40',
  watchlist: 'bg-accent-red/15 text-accent-red ring-accent-red/40',
};

function seedEvents(): ActivityEvent[] {
  return [
    { id: 's4', time: alertStreamTime(-34), text: 'ANPR read GJ01KL4477', plate: 'GJ01KL4477', camera: 'C-001', icon: activityPool[0].icon, tone: 'info' },
    { id: 's3', time: alertStreamTime(-26), text: 'Busker-group pattern at footbridge', camera: 'C-052', icon: activityPool[8].icon, tone: 'alert' },
    { id: 's2', time: alertStreamTime(-18), text: 'Watchlist scan GJ07HJ5566 — STALE MATCH', plate: 'GJ07HJ5566', camera: 'C-015', icon: activityPool[4].icon, tone: 'watchlist' },
    { id: 's1', time: alertStreamTime(-10), text: 'Speed sample GJ05FG3322 · 104 km/h', plate: 'GJ05FG3322', camera: 'C-038', icon: activityPool[3].icon, tone: 'warning' },
  ];
}

/** Small simulated AI/ANPR ingest ticker — stands in for the `alert:new` / `anpr:hit` socket. */
export function LiveActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>(seedEvents);
  const counter = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      counter.current += 1;
      const tick = counter.current;
      const template = activityPool[Math.floor(Math.random() * activityPool.length)];
      const plate = template.plate ? activityPlates[Math.floor(Math.random() * activityPlates.length)] : undefined;
      const event: ActivityEvent = {
        id: `act-${tick}`,
        time: alertStreamTime(tick * 4),
        text: template.text(plate ?? ''),
        plate,
        camera: template.camera,
        icon: template.icon,
        tone: plate === 'GJ01AB1234' ? 'watchlist' : template.tone,
      };
      setEvents((prev) => [event, ...prev].slice(0, 9));
    }, 3800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Panel
      title="Live Activity"
      tools={
        <span className="flex items-center gap-1 text-3xs text-accent-green">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          AI + ANPR stream
        </span>
      }
      action={<span className="tnum text-3xs text-ink-dim">last 5 min · {events.length}</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-[3px] overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div
            key={event.id}
            className={`flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[4px] transition-colors ${
              toneRow[event.tone]
            } ${index === 0 ? 'animate-flash-in ring-1 ring-accent-cyan/30' : ''}`}
          >
            <span className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full ring-1 ${toneIcon[event.tone]}`}>
              <Icon size={9} strokeWidth={2.2} />
            </span>
            <span className={`min-w-0 flex-1 truncate text-[11px] ${event.tone === 'watchlist' || event.tone === 'alert' ? 'text-[#ffd2d6]' : 'text-[#c3cfe2]'}`}>
              {event.text}
            </span>
            <span className="tnum shrink-0 text-[10px] text-[#8ea1c0]">{event.camera}</span>
            <span className="tnum shrink-0 text-[10px] text-[#6d7f9e]">{event.time.replace(/\s?[AP]M$/, '')}</span>
          </div>
        );
      })}
    </Panel>
  );
}
