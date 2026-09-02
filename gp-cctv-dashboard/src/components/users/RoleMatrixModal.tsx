import { useEffect } from 'react';
import { Crown, X } from 'lucide-react';

import { permissionCount, roleAccent, PERMISSIONS } from '@/data/usersData';
import { PermBadge, fieldLabel } from '@/components/users/userTones';
import type { PermissionLevel, RoleDef } from '@/types/users';

interface RoleMatrixModalProps {
  role: RoleDef | null;
  onClose: () => void;
}

const levelNote: Record<PermissionLevel, string> = {
  full: 'Full access — create, read, update and control actions are permitted.',
  partial: 'Limited access — scoped to the operator\u2019s command, read-only or action-gated.',
  none: 'Restricted — the module is hidden and API calls are denied by the RBAC policy.',
};

/** Read-only permission matrix for a role (future hook for policy editing). */
export function RoleMatrixModal({ role, onClose }: RoleMatrixModalProps) {
  useEffect(() => {
    if (!role) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [role, onClose]);

  if (!role) return null;

  const accent = roleAccent[role.accent];
  const counts = permissionCount(role.permissions);
  const Icon = role.icon;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close role matrix"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative flex max-h-[88vh] w-[640px] max-w-[94vw] flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-drawer-in">
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border ${accent.chip}`}>
              <Icon size={17} className={accent.icon} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-white">
                {role.name}
              </h2>
              <p className="mt-[1px] text-[11.5px] text-ink-dim">
                RBAC role matrix · <span className={`font-semibold ${accent.text}`}>{role.clearance}</span> ·{' '}
                {role.userCount} provisioned accounts
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          <p className="rounded-md border border-edge bg-[#0c1424] px-3 py-2 text-[12px] leading-relaxed text-[#b8c6dc]">
            {role.description}
          </p>

          <div className="mt-3">
            <label className={fieldLabel}>Module permissions</label>
            <div className="overflow-hidden rounded-md border border-edge">
              {PERMISSIONS.map((perm, index) => {
                const level = role.permissions[perm.key];
                const PermIcon = perm.icon;
                return (
                  <div
                    key={perm.key}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      index % 2 === 0 ? 'bg-[#0c1424]' : 'bg-[#0a1220]'
                    }`}
                  >
                    <PermIcon size={15} className="shrink-0 text-[#7c8db0]" />
                    <span className="w-[132px] shrink-0 text-[12.5px] font-semibold text-[#dbe5f4]">
                      {perm.label}
                    </span>
                    <PermBadge level={level} label={level === 'full' ? 'Granted' : level === 'partial' ? 'Limited' : 'Restricted'} />
                    <span className="ml-auto hidden min-w-0 flex-1 text-right text-[11px] leading-snug text-[#6d7f9e] sm:block">
                      {levelNote[level]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-md border border-accent-green/30 bg-accent-green/[0.07] px-3 py-2">
              <div className="tnum text-[16px] font-bold text-[#6fe0b0]">{counts.full}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#4fc48d]">granted</div>
            </div>
            <div className="rounded-md border border-accent-orange/30 bg-accent-orange/[0.07] px-3 py-2">
              <div className="tnum text-[16px] font-bold text-[#f6b95c]">{counts.partial}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#e08d3c]">limited</div>
            </div>
            <div className="rounded-md border border-edge-strong bg-[#0c1424] px-3 py-2">
              <div className="tnum text-[16px] font-bold text-[#9fb0cc]">{counts.none}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6d7f9e]">restricted</div>
            </div>
          </div>

          {role.id === 'super-admin' ? (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-purple/30 bg-accent-purple/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-[#d0a4f7]">
              <Crown size={14} className="mt-px shrink-0" />
              Super Administrators bypass module restrictions. Changes to this role require a second
              Level-4 officer&apos;s approval and are written to the immutable audit log.
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-[#5c6b87]">
              Role changes propagate to all {role.userCount} accounts within 60 seconds. Individual
              operator overrides remain editable from the user profile drawer.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-[32px] items-center rounded-[5px] border border-edge bg-[#0c1424] px-4 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[32px] items-center rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-4 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
