import { useEffect, useState } from 'react';
import { Bell, Car, ShieldAlert } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { api } from '@/services/api';
import { createRealtimeChannel } from '@/services/realtime';
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

const clockOf = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/** Real AI/ANPR activity rail. No synthetic ticker or demo events are generated. */
export function LiveActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      Promise.all([
        api.getRecentAnpr(5).catch(() => []),
        api.getAlerts({ limit: 5 }).catch(() => ({ items: [] })),
      ]).then(([anpr, alerts]) => {
        if (cancelled) return;
        setOnline(true);
        const rows: ActivityEvent[] = [
          ...anpr.map((hit) => ({
            id: `anpr-${hit.id}`,
            time: clockOf(hit.seen_at),
            text: `ANPR read ${hit.plate}`,
            plate: hit.plate,
            camera: hit.camera_id,
            icon: Car,
            tone: 'info' as const,
          })),
          ...alerts.items.map((alert) => ({
            id: `alert-${alert.alert_id}`,
            time: clockOf(alert.created_at),
            text: alert.message,
            plate: alert.plate ?? undefined,
            camera: alert.camera_id ?? '—',
            icon: alert.type === 'WATCHLIST_MATCH' ? ShieldAlert : Bell,
            tone: alert.type === 'WATCHLIST_MATCH' ? ('watchlist' as const) : alert.severity === 'critical' || alert.severity === 'high' ? ('alert' as const) : ('warning' as const),
          })),
        ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 9);
        setEvents(rows);
      }).catch(() => setOnline(false));
    };
    pull();
    const timer = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const offAnpr = bus.on('anpr:hit', pull);
    const offAlert = bus.on('alert:new', pull);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      offAnpr();
      offAlert();
      bus.close();
    };
  }, []);

  return (
    <Panel
      title="Live Activity"
      tools={<span className={`flex items-center gap-1 text-3xs ${online ? 'text-accent-green' : 'text-ink-dim'}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-accent-green animate-pulse-dot' : 'bg-slate-500'}`} />AI + ANPR stream</span>}
      action={<span className="tnum text-3xs text-ink-dim">backend · {events.length}</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-[3px] overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {events.length ? events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={event.id} className={`flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[4px] transition-colors ${toneRow[event.tone]} ${index === 0 ? 'animate-flash-in ring-1 ring-accent-cyan/30' : ''}`}>
            <span className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full ring-1 ${toneIcon[event.tone]}`}><Icon size={9} strokeWidth={2.2} /></span>
            <span className={`min-w-0 flex-1 truncate text-[11px] ${event.tone === 'watchlist' || event.tone === 'alert' ? 'text-[#ffd2d6]' : 'text-[#c3cfe2]'}`}>{event.text}</span>
            <span className="tnum shrink-0 text-[10px] text-[#8ea1c0]">{event.camera}</span>
            <span className="tnum shrink-0 text-[10px] text-[#6d7f9e]">{event.time.replace(/\s?[AP]M$/, '')}</span>
          </div>
        );
      }) : <div className="grid min-h-[160px] place-items-center rounded-[4px] border border-dashed border-edge bg-[#071120] px-3 text-center text-[11.5px] text-ink-dim">No realtime AI, ANPR or alert activity reported by backend.</div>}
    </Panel>
  );
}
