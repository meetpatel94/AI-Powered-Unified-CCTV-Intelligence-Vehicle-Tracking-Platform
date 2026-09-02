import {
  Ban,
  FileDown,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { accessEvents } from '@/data/usersData';
import type { AccessEvent, AccessEventType } from '@/types/users';

const eventMeta: Record<
  AccessEventType,
  { icon: typeof LogIn; wrap: string; label: string }
> = {
  login: { icon: LogIn, wrap: 'border-accent-green/40 bg-accent-green/12 text-[#6fe0b0]', label: 'Login' },
  logout: { icon: LogOut, wrap: 'border-edge-strong bg-[#101a2e] text-[#9fb0cc]', label: 'Logout' },
  'permission-change': {
    icon: ShieldCheck,
    wrap: 'border-accent-purple/40 bg-accent-purple/12 text-[#d0a4f7]',
    label: 'Permission change',
  },
  'report-export': {
    icon: FileDown,
    wrap: 'border-accent-cyan/40 bg-accent-cyan/12 text-[#67e8f9]',
    label: 'Report export',
  },
  'watchlist-update': {
    icon: ShieldAlert,
    wrap: 'border-accent-orange/40 bg-accent-orange/12 text-[#f6b95c]',
    label: 'Watchlist update',
  },
  investigation: {
    icon: ScrollText,
    wrap: 'border-accent-red/40 bg-accent-red/12 text-[#f79aa4]',
    label: 'Investigation',
  },
  invite: { icon: Mail, wrap: 'border-accent-blue/40 bg-accent-blue/12 text-[#9fc7ff]', label: 'Invitation' },
  reset: { icon: KeyRound, wrap: 'border-accent-orange/40 bg-accent-orange/12 text-[#f6b95c]', label: 'Access reset' },
  disable: { icon: Ban, wrap: 'border-accent-red/40 bg-accent-red/12 text-[#f79aa4]', label: 'Account disabled' },
};

function TimelineRow({ event, isLast }: { event: AccessEvent; isLast: boolean }) {
  const meta = eventMeta[event.type];
  const Icon = meta.icon;
  return (
    <li className="relative flex gap-3 pb-3.5">
      {!isLast ? (
        <span className="absolute left-[15px] top-[32px] h-[calc(100%-30px)] w-px bg-edge" aria-hidden />
      ) : null}
      <span
        className={`z-10 grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full border ${meta.wrap}`}
      >
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-semibold text-[#dbe5f4]">
            {event.label}
          </span>
          <span className="tnum shrink-0 text-[11px] font-medium text-ink-dim">
            {event.time} · {event.minutesAgo < 60 ? `${event.minutesAgo}m ago` : `${Math.floor(event.minutesAgo / 60)}h ago`}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-dim">{event.detail}</p>
        <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#6d7f9e]">
          by {event.userName} <span className="tnum normal-case tracking-normal text-[#5c6b87]">· {event.userId}</span>
        </div>
      </div>
    </li>
  );
}

/** RECENT ACCESS ACTIVITY audit-timeline feed (frontend mock of the audit log). */
export function AccessActivityPanel() {
  return (
    <Panel
      title="Recent Access Activity"
      action={
        <span className="flex items-center gap-1.5 text-3xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          audit log · live
        </span>
      }
      className="min-h-0"
      bodyClassName="min-h-0 overflow-y-auto px-3 py-3"
    >
      <ul>
        {accessEvents.map((event, index) => (
          <TimelineRow key={event.id} event={event} isLast={index === accessEvents.length - 1} />
        ))}
      </ul>
    </Panel>
  );
}
