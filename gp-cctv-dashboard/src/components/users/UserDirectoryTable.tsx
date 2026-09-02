import { useState } from 'react';
import {
  Activity,
  Ban,
  RotateCcw,
  Eye,
  KeyRound,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Pencil,
  SearchX,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import {
  effectivePermission,
  formatLastActive,
  roleAccent,
  roleById,
  statusMeta,
  PERMISSIONS,
} from '@/data/usersData';
import { PermDot, StatusBadge, UserAvatar } from '@/components/users/userTones';
import type { PermissionLevel, UserRecord } from '@/types/users';

export type UserRowAction = 'edit' | 'reset' | 'disable' | 'enable' | 'activity';

interface UserDirectoryTableProps {
  users: UserRecord[];
  totalAccounts: number;
  selectedId: string | null;
  view: 'table' | 'grid';
  onViewToggle: (view: 'table' | 'grid') => void;
  onSelect: (user: UserRecord) => void;
  onAction: (user: UserRecord, action: UserRowAction) => void;
  onResetFilters: () => void;
}

function PermSummary({ user }: { user: UserRecord }) {
  const counts = { full: 0, partial: 0, none: 0 };
  PERMISSIONS.forEach((perm) => {
    counts[effectivePermission(user, perm.key)] += 1;
  });
  return (
    <span
      title={`${counts.full} granted · ${counts.partial} limited · ${counts.none} restricted`}
      className="inline-flex items-center gap-1"
    >
      <PermDot level="full" label="Granted" />
      <span className="tnum text-[12px] font-semibold text-[#6fe0b0]">{counts.full}</span>
      <PermDot level="partial" label="Limited" />
      <span className="tnum text-[12px] font-semibold text-[#f6b95c]">{counts.partial}</span>
      <PermDot level="none" label="Restricted" />
      <span className="tnum text-[12px] font-semibold text-[#65799b]">{counts.none}</span>
    </span>
  );
}

function RowActions({
  user,
  onAction,
}: {
  user: UserRecord;
  onAction: (user: UserRecord, action: UserRowAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const item =
    'flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium text-[#c3cfe2] transition-colors hover:bg-panel-hover hover:text-white';

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button
        type="button"
        title="View profile"
        onClick={(event) => {
          event.stopPropagation();
          onAction(user, 'activity');
        }}
        className="grid h-[26px] w-[26px] place-items-center rounded-[4px] text-[#8ea3c4] transition-colors hover:bg-panel-hover hover:text-accent-cyan"
      >
        <Eye size={14} />
      </button>
      <button
        type="button"
        title="Edit user"
        onClick={(event) => {
          event.stopPropagation();
          onAction(user, 'edit');
        }}
        className="grid h-[26px] w-[26px] place-items-center rounded-[4px] text-[#8ea3c4] transition-colors hover:bg-panel-hover hover:text-accent-blue"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        title="More actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`grid h-[26px] w-[26px] place-items-center rounded-[4px] transition-colors ${
          open ? 'bg-panel-hover text-white' : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
        }`}
      >
        <MoreHorizontal size={15} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 top-[30px] z-30 w-[188px] overflow-hidden rounded-md border border-edge-strong bg-[#0c1424] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.85)]">
            <button
              type="button"
              className={item}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onAction(user, 'reset');
              }}
            >
              <KeyRound size={13} className="text-accent-orange" />
              Reset Access
            </button>
            <button
              type="button"
              className={item}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onAction(user, 'activity');
              }}
            >
              <Activity size={13} className="text-accent-cyan" />
              View Activity Log
            </button>
            <div className="my-px h-px bg-edge" />
            {user.status === 'disabled' ? (
              <button
                type="button"
                className={item}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  onAction(user, 'enable');
                }}
              >
                <RotateCcw size={13} className="text-accent-green" />
                Enable Account
              </button>
            ) : (
              <button
                type="button"
                className={`${item} hover:text-[#ff8b96]`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  onAction(user, 'disable');
                }}
              >
                <Ban size={13} className="text-accent-red" />
                Disable User
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PermMatrixRow({ user }: { user: UserRecord }) {
  return (
    <span className="hidden items-center gap-[3px] 2xl:inline-flex">
      {PERMISSIONS.map((perm) => {
        const level: PermissionLevel = effectivePermission(user, perm.key);
        return <PermDot key={perm.key} level={level} label={perm.label} />;
      })}
    </span>
  );
}

function UserGridCard({
  user,
  selected,
  onSelect,
  onAction,
}: {
  user: UserRecord;
  selected: boolean;
  onSelect: (user: UserRecord) => void;
  onAction: (user: UserRecord, action: UserRowAction) => void;
}) {
  const role = roleById(user.roleId);
  const accent = roleAccent[role.accent];
  const status = statusMeta[user.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className={`group flex min-w-0 flex-col gap-2.5 rounded-md border bg-panel p-3 text-left transition-all hover:border-edge-strong hover:bg-panel-hover ${
        selected ? 'border-accent-blue/70 shadow-glow' : 'border-edge'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar initials={user.initials} hue={user.hue} size={40} status={user.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">{user.name}</div>
          <div className="tnum truncate text-[11px] text-ink-dim">
            {user.rank} · {user.employeeId}
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>

      <div className={`inline-flex w-fit items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11px] font-semibold ${accent.chip} ${accent.text}`}>
        <role.icon size={11} />
        {role.short}
      </div>

      <div className="space-y-1 text-[11.5px] text-ink-dim">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={11} className="shrink-0 text-[#6d7f9e]" />
          <span className="truncate">{user.departmentLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="shrink-0 text-[#6d7f9e]" />
          <span className="truncate">{user.location}</span>
        </div>
        <div className="tnum flex items-center gap-1.5">
          <UserCheck size={11} className="shrink-0 text-[#6d7f9e]" />
          <span className={status.text}>{formatLastActive(user.lastActiveMinutes)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-edge-soft pt-2">
        <PermSummary user={user} />
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onAction(user, 'edit');
          }}
          className="grid h-[26px] w-[26px] place-items-center rounded-[4px] text-[#8ea3c4] transition-colors hover:bg-[#16233a] hover:text-accent-blue"
        >
          <Pencil size={13} />
        </span>
      </div>
    </button>
  );
}

/** Main USER DIRECTORY workspace: dense table (list) or card grid. */
export function UserDirectoryTable({
  users,
  totalAccounts,
  selectedId,
  view,
  onViewToggle,
  onSelect,
  onAction,
  onResetFilters,
}: UserDirectoryTableProps) {
  return (
    <Panel
      title="User Directory"
      action={
        <span className="tnum text-3xs text-ink-dim">
          showing {users.length} of {totalAccounts} platform accounts
        </span>
      }
      tools={
        <div className="flex items-center gap-px overflow-hidden rounded-[5px] border border-edge bg-[#0a1120] p-px">
          <button
            type="button"
            title="Table view"
            onClick={() => onViewToggle('table')}
            className={`grid h-[26px] w-[30px] place-items-center rounded-[4px] transition-all ${
              view === 'table'
                ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white'
                : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
            }`}
          >
            <List size={13} />
          </button>
          <button
            type="button"
            title="Grid view"
            onClick={() => onViewToggle('grid')}
            className={`grid h-[26px] w-[30px] place-items-center rounded-[4px] transition-all ${
              view === 'grid'
                ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white'
                : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
            }`}
          >
            <LayoutGrid size={13} />
          </button>
        </div>
      }
      className="min-h-0"
      bodyClassName="min-h-0 overflow-auto"
    >
      {users.length === 0 ? (
        <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 text-center">
          <SearchX size={30} strokeWidth={1.5} className="text-[#5a6b8a]" />
          <div className="text-[13.5px] font-semibold text-[#c3cfe2]">No operators match the current filters</div>
          <div className="text-[12px] text-ink-dim">Try clearing the search or widening department / role filters.</div>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-1 rounded-[5px] border border-edge bg-[#0c1424] px-3 py-1.5 text-[12px] font-medium text-[#9fc7ff] transition-colors hover:border-accent-blue/60"
          >
            Reset filters
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <UserGridCard
              key={user.id}
              user={user}
              selected={selectedId === user.id}
              onSelect={onSelect}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0c1425] text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7c8db0]">
              <th className="px-3 py-2.5 font-bold">Operator</th>
              <th className="px-2 py-2.5 font-bold">Role</th>
              <th className="px-2 py-2.5 font-bold">Department</th>
              <th className="px-2 py-2.5 font-bold">Location</th>
              <th className="px-2 py-2.5 font-bold">Status</th>
              <th className="px-2 py-2.5 font-bold">Last Active</th>
              <th className="px-2 py-2.5 font-bold">
                Permissions
                <span className="ml-1.5 hidden font-medium normal-case tracking-normal text-[#5c6b87] 2xl:inline">
                  (dash · live · map · search · watch · alerts · inv · rpt · health · users)
                </span>
              </th>
              <th className="px-3 py-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const role = roleById(user.roleId);
              const accent = roleAccent[role.accent];
              const status = statusMeta[user.status];
              const selected = selectedId === user.id;
              return (
                <tr
                  key={user.id}
                  onClick={() => onSelect(user)}
                  className={`cursor-pointer border-t border-edge-soft transition-colors ${
                    selected ? 'bg-accent-blue/[0.08]' : 'hover:bg-panel-hover/60'
                  }`}
                >
                  {/* operator */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar initials={user.initials} hue={user.hue} size={34} status={user.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold text-white">{user.name}</span>
                          {user.mfa ? (
                            <ShieldCheck size={12} className="shrink-0 text-accent-green/80" aria-label="MFA enabled" />
                          ) : null}
                        </div>
                        <div className="tnum truncate text-[11px] text-ink-dim">
                          {user.rank} · {user.employeeId}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* role */}
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2 py-[3px] text-[11px] font-semibold ${accent.chip} ${accent.text}`}
                    >
                      <role.icon size={11} />
                      {role.short}
                    </span>
                  </td>

                  {/* department */}
                  <td className="px-2 py-2">
                    <span className="block max-w-[170px] truncate text-[12px] text-[#c3cfe2]">
                      {user.departmentLabel}
                    </span>
                  </td>

                  {/* location */}
                  <td className="px-2 py-2">
                    <span className="flex max-w-[190px] items-center gap-1.5 text-[12px] text-ink-dim">
                      <MapPin size={11} className="shrink-0 text-[#6d7f9e]" />
                      <span className="truncate">{user.location}</span>
                    </span>
                  </td>

                  {/* status */}
                  <td className="px-2 py-2">
                    <StatusBadge status={user.status} />
                  </td>

                  {/* last active */}
                  <td className="px-2 py-2">
                    <span className={`tnum whitespace-nowrap text-[12px] font-medium ${status.text}`}>
                      {formatLastActive(user.lastActiveMinutes)}
                    </span>
                  </td>

                  {/* permissions */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <PermSummary user={user} />
                      <PermMatrixRow user={user} />
                    </div>
                  </td>

                  {/* actions */}
                  <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                    <RowActions user={user} onAction={onAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
