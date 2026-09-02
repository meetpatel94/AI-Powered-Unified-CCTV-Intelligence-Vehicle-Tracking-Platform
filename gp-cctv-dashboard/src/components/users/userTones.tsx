import { Check, Minus, X } from 'lucide-react';

import { statusMeta } from '@/data/usersData';
import type { PermissionLevel, UserStatus } from '@/types/users';

/* ------------------------------------------------------------------ *
 * Avatar — initials tile with a deterministic navy/blue hue ramp
 * (avatars are officer initials; no real personnel imagery is stored).
 * ------------------------------------------------------------------ */

const avatarPalette = [
  'from-[#16345f] to-[#0c1c36] text-[#9fc7ff] ring-[#23508f]',
  'from-[#3c2157] to-[#1d1030] text-[#d8b3f7] ring-[#6b3aa0]',
  'from-[#0f3a36] to-[#0a201d] text-[#7fe3d2] ring-[#1d7a6d]',
  'from-[#3d2a0c] to-[#211605] text-[#f6c87a] ring-[#8a6415]',
  'from-[#12345f] to-[#0a1a31] text-[#a8c8f5] ring-[#25559a]',
  'from-[#3f1530] to-[#220b18] text-[#f3a5c0] ring-[#8a2f58]',
  'from-[#143b30] to-[#0a1f18] text-[#8fe6b4] ring-[#1f7a55]',
  'from-[#2b2f5f] to-[#141630] text-[#b8bff5] ring-[#4650a0]',
  'from-[#0f2f4a] to-[#081827] text-[#8fd4f5] ring-[#1f6090]',
  'from-[#3a1e44] to-[#1c0e22] text-[#d8a8e8] ring-[#7a3f90]',
  'from-[#10364a] to-[#081c26] text-[#9fdcf0] ring-[#1f6a8a]',
  'from-[#44240f] to-[#241205] text-[#f0b88a] ring-[#905f1f]',
];

export function UserAvatar({
  initials,
  hue,
  size = 36,
  status,
}: {
  initials: string;
  hue: number;
  size?: number;
  status?: UserStatus;
}) {
  const palette = avatarPalette[hue % avatarPalette.length];
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`grid place-items-center rounded-full bg-gradient-to-br font-bold ring-1 ${palette}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials}
      </span>
      {status ? (
        <span
          title={statusMeta[status].label}
          className={`absolute -bottom-0.5 -right-0.5 h-[10px] w-[10px] rounded-full border-2 border-[#0b1222] ${statusMeta[status].dot}`}
        />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Status badge
 * ------------------------------------------------------------------ */

export function StatusBadge({ status, className = '' }: { status: UserStatus; className?: string }) {
  const meta = statusMeta[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-semibold ring-1 ${meta.ring} ${meta.text} ${className}`}
    >
      <span className={`h-[6px] w-[6px] rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Permission indicators (readable enabled / restricted / disabled)
 * ------------------------------------------------------------------ */

const permMeta: Record<
  PermissionLevel,
  { icon: typeof Check; wrap: string; label: string }
> = {
  full: {
    icon: Check,
    wrap: 'border-accent-green/40 bg-accent-green/10 text-[#6fe0b0]',
    label: 'Granted',
  },
  partial: {
    icon: Minus,
    wrap: 'border-accent-orange/40 bg-accent-orange/10 text-[#f6b95c]',
    label: 'Limited',
  },
  none: {
    icon: X,
    wrap: 'border-edge-strong bg-[#0c1424] text-[#65799b]',
    label: 'Restricted',
  },
};

/** Compact square indicator used in table cells and permission matrices. */
export function PermDot({ level, label }: { level: PermissionLevel; label?: string }) {
  const meta = permMeta[level];
  const Icon = meta.icon;
  return (
    <span
      title={label ? `${label} — ${meta.label}` : meta.label}
      className={`inline-grid h-[22px] w-[22px] place-items-center rounded-[4px] border ${meta.wrap}`}
    >
      <Icon size={12} strokeWidth={3} />
    </span>
  );
}

/** Text badge used in profile summaries and role cards. */
export function PermBadge({ level, label }: { level: PermissionLevel; label: string }) {
  const meta = permMeta[level];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11.5px] font-medium ${meta.wrap}`}
    >
      <Icon size={11} strokeWidth={3} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Shared control styles (mirror the other pages for consistency)
 * ------------------------------------------------------------------ */

export const selectCls =
  'h-[32px] shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[12.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

export const secondaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

export const iconBtn =
  'grid h-[34px] w-[34px] place-items-center rounded-[5px] border border-edge bg-panel text-[#8ea3c4] transition-colors hover:border-edge-strong hover:text-white';

export const fieldLabel =
  'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]';

export const inputCls =
  'h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[12.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70';
