import { useEffect } from 'react';
import {
  Activity,
  Ban,
  BellRing,
  Building2,
  CalendarDays,
  Camera,
  Clock,
  Fingerprint,
  KeyRound,
  Laptop,
  MapPin,
  Pencil,
  Siren,
  X,
} from 'lucide-react';

import {
  accessEvents,
  effectivePermission,
  formatLastActive,
  roleAccent,
  roleById,
  PERMISSIONS,
} from '@/data/usersData';
import { PermBadge, StatusBadge, UserAvatar } from '@/components/users/userTones';
import type { UserRecord } from '@/types/users';

export type DrawerAction = 'edit' | 'reset' | 'disable' | 'enable';

interface UserProfileDrawerProps {
  user: UserRecord | null;
  onClose: () => void;
  onAction: (user: UserRecord, action: DrawerAction) => void;
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-[5px] border border-edge bg-[#0c1424] px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">{label}</div>
      <div className={`mt-[2px] truncate text-[12px] font-medium text-[#dbe6f5] ${mono ? 'tnum' : ''}`}>{value}</div>
    </div>
  );
}

/** Right slide-over: full operator profile, access scope, permissions and activity. */
export function UserProfileDrawer({ user, onClose, onAction }: UserProfileDrawerProps) {
  useEffect(() => {
    if (!user) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [user, onClose]);

  if (!user) return null;

  const role = roleById(user.roleId);
  const accent = roleAccent[role.accent];
  const userEvents = accessEvents.filter((event) => event.userId === user.id).slice(0, 4);

  const btn =
    'flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-[5px] border text-[11.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close profile"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[min(540px,94vw)] animate-drawer-in flex-col border-l border-edge bg-[#0a1120] shadow-[0_0_40px_rgba(0,0,0,0.65)]">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border ${accent.chip}`}>
              <role.icon size={13} className={accent.icon} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-bold uppercase tracking-[0.06em] text-white">
                Operator Profile
              </div>
              <div className="tnum text-[11px] text-ink-dim">{user.employeeId} · access record</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {/* identity hero */}
          <div className="rounded-md border border-edge bg-[#0c1424] p-3.5">
            <div className="flex items-center gap-3">
              <UserAvatar initials={user.initials} hue={user.hue} size={56} status={user.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold leading-tight text-white">{user.name}</div>
                <div className="mt-0.5 text-[12px] text-ink-dim">
                  {user.rank} · <span className="tnum">{user.employeeId}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.05em] ${accent.chip} ${accent.text}`}
                  >
                    <role.icon size={10} />
                    {role.name}
                  </span>
                  <StatusBadge status={user.status} />
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <DetailField label="Department" value={user.departmentLabel} />
              <DetailField label="Command / Location" value={user.location} />
              <DetailField label="Email" value={user.email} />
              <DetailField label="Phone" value={user.phone} />
              <DetailField label="Last Login" value={user.lastLogin} mono />
              <DetailField label="Last Active" value={formatLastActive(user.lastActiveMinutes)} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-dim">
              <span className="flex items-center gap-1.5">
                <Fingerprint size={12} className={user.mfa ? 'text-accent-green' : 'text-accent-red'} />
                MFA {user.mfa ? 'enforced' : 'not enrolled'}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={12} className="text-[#6d7f9e]" />
                {user.joined}
              </span>
              <span className="flex items-center gap-1.5">
                <Laptop size={12} className="text-[#6d7f9e]" />
                Gujarat Police domain
              </span>
            </div>
          </div>

          {/* operational stats */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-md border border-accent-blue/30 bg-accent-blue/[0.07] px-2.5 py-2.5 text-center">
              <Camera size={15} className="mx-auto text-[#4f9dff]" />
              <div className="tnum mt-1 text-[17px] font-bold leading-none text-[#9fc7ff]">
                {user.assignedCameras.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6f9ad4]">
                Assigned cameras
              </div>
            </div>
            <div className="rounded-md border border-accent-red/30 bg-accent-red/[0.07] px-2.5 py-2.5 text-center">
              <Siren size={15} className="mx-auto text-[#ef4444]" />
              <div className="tnum mt-1 text-[17px] font-bold leading-none text-[#f79aa4]">
                {user.activeInvestigations}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#e2707d]">
                Active investigations
              </div>
            </div>
            <div className="rounded-md border border-accent-green/30 bg-accent-green/[0.07] px-2.5 py-2.5 text-center">
              <BellRing size={15} className="mx-auto text-[#34d399]" />
              <div className="tnum mt-1 text-[17px] font-bold leading-none text-[#6fe0b0]">
                {user.alertsHandled.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#4fc48d]">
                Alerts handled
              </div>
            </div>
          </div>

          {/* camera scope */}
          <div className="mt-3 rounded-md border border-edge p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c8db0]">
              <Camera size={12} /> Camera Access Scope
            </div>
            {user.cameraLabels[0] === 'ALL ZONES' ? (
              <div className="rounded-[4px] border border-accent-purple/40 bg-accent-purple/10 px-2.5 py-1.5 text-[12px] font-semibold text-[#d0a4f7]">
                Unrestricted — all backend-registered cameras across Gujarat commands
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {user.cameraLabels.map((code) => (
                  <span
                    key={code}
                    className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-2 py-1 text-[11.5px] font-semibold text-[#9fc7ff]"
                  >
                    {code}
                  </span>
                ))}
                <span className="rounded-[4px] px-2 py-1 text-[11px] text-ink-dim">
                  + {Math.max(0, user.assignedCameras - user.cameraLabels.length)} more in assigned clusters
                </span>
              </div>
            )}
          </div>

          {/* permission matrix */}
          <div className="mt-3 rounded-md border border-edge p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c8db0]">
              <KeyRound size={12} /> Effective Permissions
              <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-[#5c6b87]">
                {user.permissions ? 'includes operator overrides' : 'inherited from role'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PERMISSIONS.map((perm) => {
                const level = effectivePermission(user, perm.key);
                const PIcon = perm.icon;
                return (
                  <div
                    key={perm.key}
                    className={`flex items-center gap-2 rounded-[4px] border px-2 py-1.5 ${
                      level === 'full'
                        ? 'border-accent-green/25 bg-accent-green/[0.05]'
                        : level === 'partial'
                          ? 'border-accent-orange/25 bg-accent-orange/[0.05]'
                          : 'border-edge-soft bg-[#0c1424]'
                    }`}
                  >
                    <PIcon size={12} className={level === 'none' ? 'text-[#65799b]' : 'text-[#9fb0cc]'} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#c3cfe2]">
                      {perm.label}
                    </span>
                    <PermBadge
                      level={level}
                      label={level === 'full' ? 'Full' : level === 'partial' ? 'Limited' : 'None'}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* recent activity */}
          <div className="mt-3 rounded-md border border-edge p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c8db0]">
              <Activity size={12} /> Recent Access Activity
            </div>
            {userEvents.length === 0 ? (
              <p className="flex items-center gap-2 text-[12px] text-ink-dim">
                <Clock size={12} className="text-[#6d7f9e]" />
                No console activity recorded in this shift window.
              </p>
            ) : (
              <ul className="space-y-2">
                {userEvents.map((event) => (
                  <li key={event.id} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent-cyan" />
                    <div className="min-w-0">
                      <span className="font-medium text-[#dbe5f4]">{event.label}</span>
                      <span className="text-ink-dim"> — {event.detail}</span>
                      <div className="tnum text-[10.5px] text-[#6d7f9e]">
                        {event.time} · {event.minutesAgo < 60 ? `${event.minutesAgo}m ago` : `${Math.floor(event.minutesAgo / 60)}h ago`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-edge-soft bg-[#0a1120] px-3 py-2 text-[11px] text-[#5c6b87]">
            <Building2 size={12} className="shrink-0" />
            All provisioning, reset and disable actions are recorded to the immutable Gujarat Police
            audit log with the acting officer&apos;s credentials.
          </div>
        </div>

        {/* footer actions */}
        <footer className="shrink-0 space-y-1.5 border-t border-edge bg-[#080f1c] px-3.5 py-2.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onAction(user, 'edit')}
              className={`${btn} border-accent-blue/50 bg-accent-blue/15 text-[#9fc7ff] hover:bg-accent-blue/25`}
            >
              <Pencil size={13} />
              Edit User
            </button>
            <button
              type="button"
              onClick={() => onAction(user, 'reset')}
              className={`${btn} border-accent-orange/40 bg-accent-orange/10 text-[#f6b95c] hover:bg-accent-orange/20`}
            >
              <KeyRound size={13} />
              Reset Access
            </button>
          </div>
          <div className="flex gap-1.5">
            {user.status === 'disabled' ? (
              <button
                type="button"
                onClick={() => onAction(user, 'enable')}
                className={`${btn} flex-[2] border-accent-green/40 bg-accent-green/10 text-[#6fe0b0] hover:bg-accent-green/20`}
              >
                <Activity size={13} />
                Enable Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAction(user, 'disable')}
                className={`${btn} flex-[2] border-accent-red/40 bg-accent-red/10 text-[#f79aa4] hover:bg-accent-red/20`}
              >
                <Ban size={13} />
                Disable User
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`${btn} border-edge bg-[#0c1424] text-[#c3cfe2] hover:border-edge-strong hover:text-white`}
            >
              Close
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[10.5px] text-[#5c6b87]">
            <MapPin size={10} />
            {user.city} command · actions from this drawer are audit-logged
          </div>
        </footer>
      </aside>
    </div>
  );
}
