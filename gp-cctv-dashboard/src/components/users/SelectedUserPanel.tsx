import type { ReactNode } from 'react';
import {
  Activity,
  Ban,
  Camera,
  Clock,
  Fingerprint,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Siren,
  BellRing,
  UserX,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import {
  effectivePermission,
  formatLastActive,
  roleAccent,
  roleById,
  PERMISSIONS,
} from '@/data/usersData';
import { StatusBadge, UserAvatar } from '@/components/users/userTones';
import type { UserRecord } from '@/types/users';

export type ProfileAction = 'edit' | 'reset' | 'disable' | 'activity';

interface SelectedUserPanelProps {
  user: UserRecord | null;
  onAction: (user: UserRecord, action: ProfileAction) => void;
}

function Stat({
  icon: Icon,
  value,
  label,
  tone = 'text-[#dbe5f4]',
}: {
  icon: typeof Camera;
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2.5 py-2">
      <div className={`tnum flex items-center gap-1.5 text-[15px] font-bold ${tone}`}>
        <Icon size={13} className="text-[#6d7f9e]" />
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6d7f9e]">{label}</div>
    </div>
  );
}

function InfoLine({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-[#b8c6dc]">
      <Icon size={12.5} className="mt-[2px] shrink-0 text-[#6d7f9e]" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Right rail: SELECTED USER profile summary with quick management actions. */
export function SelectedUserPanel({ user, onAction }: SelectedUserPanelProps) {
  if (!user) {
    return (
      <Panel title="Selected User" className="min-h-0" bodyClassName="grid min-h-0 place-items-center p-4">
        <div className="text-center">
          <UserX size={30} strokeWidth={1.4} className="mx-auto text-[#5a6b8a]" />
          <p className="mt-2 text-[13px] font-semibold text-[#c3cfe2]">No user selected</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">
            Select any operator from the directory to review their profile,
            access scope and audit activity.
          </p>
        </div>
      </Panel>
    );
  }

  const role = roleById(user.roleId);
  const accent = roleAccent[role.accent];
  const granted = PERMISSIONS.filter((p) => effectivePermission(user, p.key) === 'full').length;
  const limited = PERMISSIONS.filter((p) => effectivePermission(user, p.key) === 'partial').length;

  const actionBtn =
    'flex h-[28px] flex-1 items-center justify-center gap-1.5 rounded-[5px] border text-[11px] font-semibold uppercase tracking-[0.04em] transition-all disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Panel
      title="Selected User"
      action={<StatusBadge status={user.status} />}
      className="min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3"
    >
      {/* identity */}
      <div className="flex items-center gap-3 rounded-md border border-edge bg-[#0c1424] p-3">
        <UserAvatar initials={user.initials} hue={user.hue} size={52} status={user.status} />
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-bold leading-tight text-white">{user.name}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-dim">
            {user.rank} · <span className="tnum">{user.employeeId}</span>
          </div>
          <div
            className={`mt-1.5 inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.05em] ${accent.chip} ${accent.text}`}
          >
            <role.icon size={10} />
            {role.name}
          </div>
        </div>
      </div>

      {/* details */}
      <div className="space-y-1.5 rounded-md border border-edge p-3">
        <InfoLine icon={MapPin}>
          <span className="font-medium text-[#dbe5f4]">{user.departmentLabel}</span> · {user.location}
        </InfoLine>
        <InfoLine icon={Mail}>{user.email}</InfoLine>
        <InfoLine icon={Phone}>{user.phone}</InfoLine>
        <InfoLine icon={Clock}>
          Last login <span className="tnum">{user.lastLogin}</span> ·{' '}
          <span className="font-medium text-[#dbe5f4]">{formatLastActive(user.lastActiveMinutes)}</span>
        </InfoLine>
        <InfoLine icon={Fingerprint}>
          MFA / biometric console login:{' '}
          <span className={user.mfa ? 'font-semibold text-[#6fe0b0]' : 'font-semibold text-[#f79aa4]'}>
            {user.mfa ? 'Enforced' : 'Not enrolled'}
          </span>
        </InfoLine>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-1.5">
        <Stat icon={Camera} value={user.assignedCameras.toLocaleString('en-IN')} label="Cameras" tone="text-[#9fc7ff]" />
        <Stat icon={Siren} value={user.activeInvestigations} label="Investigations" tone="text-[#f79aa4]" />
        <Stat icon={BellRing} value={user.alertsHandled.toLocaleString('en-IN')} label="Alerts handled" tone="text-[#6fe0b0]" />
      </div>

      {/* permission summary */}
      <div className="rounded-md border border-edge p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c8db0]">
            Permission Summary
          </span>
          <span className="rounded-[3px] bg-accent-purple/15 px-1.5 py-px text-[10px] font-bold text-[#d0a4f7] ring-1 ring-accent-purple/40">
            {role.clearance}
          </span>
        </div>
        <div className="flex h-[7px] overflow-hidden rounded-full bg-[#080f1d]">
          <div className="bg-accent-green" style={{ width: `${(granted / 10) * 100}%` }} title={`${granted} granted`} />
          <div className="bg-accent-orange" style={{ width: `${(limited / 10) * 100}%` }} title={`${limited} limited`} />
          <div className="flex-1 bg-[#22304d]" title={`${10 - granted - limited} restricted`} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-[#6fe0b0]">
            <span className="h-[7px] w-[7px] rounded-[2px] bg-accent-green" /> {granted} granted
          </span>
          <span className="flex items-center gap-1 text-[#f6b95c]">
            <span className="h-[7px] w-[7px] rounded-[2px] bg-accent-orange" /> {limited} limited
          </span>
          <span className="flex items-center gap-1 text-[#8ea1c0]">
            <span className="h-[7px] w-[7px] rounded-[2px] bg-[#22304d]" /> {10 - granted - limited} restricted
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="mt-auto space-y-1.5">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onAction(user, 'edit')}
            className={`${actionBtn} border-accent-blue/50 bg-accent-blue/15 text-[#9fc7ff] hover:bg-accent-blue/25`}
          >
            <Pencil size={12} />
            Edit User
          </button>
          <button
            type="button"
            onClick={() => onAction(user, 'reset')}
            className={`${actionBtn} border-accent-orange/40 bg-accent-orange/10 text-[#f6b95c] hover:bg-accent-orange/20`}
          >
            <KeyRound size={12} />
            Reset Access
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onAction(user, 'activity')}
            className={`${actionBtn} border-edge bg-[#0c1424] text-[#c3cfe2] hover:border-edge-strong hover:text-white`}
          >
            <Activity size={12} />
            View Activity
          </button>
          <button
            type="button"
            disabled={user.status === 'disabled'}
            onClick={() => onAction(user, 'disable')}
            className={`${actionBtn} border-accent-red/40 bg-accent-red/10 text-[#f79aa4] hover:bg-accent-red/20`}
          >
            <Ban size={12} />
            Disable User
          </button>
        </div>
      </div>
    </Panel>
  );
}
