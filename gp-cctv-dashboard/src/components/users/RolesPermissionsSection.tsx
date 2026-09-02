import { ShieldCheck, UsersRound } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { permissionCount, roleAccent, roles, PERMISSIONS } from '@/data/usersData';
import { PermDot } from '@/components/users/userTones';
import type { RoleDef } from '@/types/users';

interface RolesPermissionsSectionProps {
  onOpenRole: (role: RoleDef) => void;
}

/**
 * ROLES & PERMISSIONS: role cards with a readable permission strip for each
 * of the ten platform modules. Clicking a card opens the full permission matrix.
 */
export function RolesPermissionsSection({ onOpenRole }: RolesPermissionsSectionProps) {
  return (
    <Panel
      title="Roles & Permissions"
      action={
        <span className="flex items-center gap-1.5 text-3xs text-ink-dim">
          <ShieldCheck size={11} className="text-accent-purple" />
          6 RBAC roles · enforced platform-wide
        </span>
      }
      className="min-h-0"
      bodyClassName="p-2.5"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {roles.map((role) => {
          const accent = roleAccent[role.accent];
          const counts = permissionCount(role.permissions);
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onOpenRole(role)}
              className="group flex min-h-[212px] flex-col gap-2 rounded-md border border-edge bg-[#0c1424] p-3 text-left transition-all hover:-translate-y-px hover:border-edge-strong hover:bg-panel-hover hover:shadow-panel"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border ${accent.chip}`}>
                  <Icon size={17} className={accent.icon} />
                </span>
                <span className={`tnum flex items-center gap-1 text-[11px] font-semibold ${accent.text}`}>
                  <UsersRound size={11} />
                  {role.userCount}
                </span>
              </div>

              <div>
                <div className="text-[13px] font-bold leading-tight text-white group-hover:text-[#9fc7ff]">
                  {role.name}
                </div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#6d7f9e]">
                  {role.clearance}
                </div>
              </div>

              <p className="line-clamp-3 min-h-[44px] text-[11.5px] leading-snug text-ink-dim">
                {role.description}
              </p>

              {/* permission strip */}
              <div className="mt-auto space-y-1.5 border-t border-edge-soft pt-2">
                <div className="grid grid-cols-10 gap-[3px]">
                  {PERMISSIONS.map((perm) => (
                    <span key={perm.key} className="grid place-items-center">
                      <PermDot level={role.permissions[perm.key]} label={perm.label} />
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10.5px] font-semibold">
                  <span className="text-[#6fe0b0]">{counts.full} granted</span>
                  <span className="text-[#f6b95c]">{counts.partial} limited</span>
                  <span className="text-[#8ea1c0]">{counts.none} restricted</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-edge-soft bg-[#0a1120] px-3 py-2 text-[11px] text-ink-dim">
        <span className="flex items-center gap-1.5">
          <PermDot level="full" /> Granted — full module access
        </span>
        <span className="flex items-center gap-1.5">
          <PermDot level="partial" /> Limited — scoped or read-only
        </span>
        <span className="flex items-center gap-1.5">
          <PermDot level="none" /> Restricted — no access
        </span>
        <span className="ml-auto hidden text-[#5c6b87] lg:inline">
          Click a role card to open its permission matrix
        </span>
      </div>
    </Panel>
  );
}
