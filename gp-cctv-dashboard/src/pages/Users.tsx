import { useMemo, useRef, useState } from 'react';

import { AccessActivityPanel } from '@/components/users/AccessActivityPanel';
import { AddUserModal } from '@/components/users/AddUserModal';
import { RoleMatrixModal } from '@/components/users/RoleMatrixModal';
import { RolesPermissionsSection } from '@/components/users/RolesPermissionsSection';
import { SelectedUserPanel, type ProfileAction } from '@/components/users/SelectedUserPanel';
import { UserActivityPanel } from '@/components/users/UserActivityPanel';
import { UserDirectoryTable, type UserRowAction } from '@/components/users/UserDirectoryTable';
import { UserProfileDrawer, type DrawerAction } from '@/components/users/UserProfileDrawer';
import { UsersHeader } from '@/components/users/UsersHeader';
import { UsersKpiRow } from '@/components/users/UsersKpiRow';
import {
  UsersToolbar,
  type UserFilters,
  type ViewMode,
} from '@/components/users/UsersToolbar';
import {
  cameraAssignOptions,
  departmentLabel,
  formatLastActive,
  roleById,
  users as seedUsers,
} from '@/data/usersData';
import type { NewUserInput, RoleDef, UserRecord, UserStatus } from '@/types/users';

const DEFAULT_FILTERS: UserFilters = {
  query: '',
  department: 'all',
  role: 'all',
  status: 'all',
  sort: 'recent',
  view: 'table',
};

/**
 * USERS & ACCESS CONTROL workspace: directory, selected-user rail, RBAC role
 * matrix, audit timeline and adoption analytics. Frontend mock data only;
 * action handlers are shaped for future auth / RBAC / audit-log APIs.
 */
export function Users() {
  const [userList, setUserList] = useState<UserRecord[]>(seedUsers);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(seedUsers[0]?.id ?? null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [roleMatrix, setRoleMatrix] = useState<RoleDef | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const flash = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2800);
  };

  const visibleUsers = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = userList.filter((user) => {
      if (filters.department !== 'all' && user.departmentId !== filters.department) return false;
      if (filters.role !== 'all' && user.roleId !== filters.role) return false;
      if (filters.status !== 'all' && user.status !== filters.status) return false;
      if (!q) return true;
      const role = roleById(user.roleId);
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.employeeId.toLowerCase().includes(q) ||
        role.name.toLowerCase().includes(q) ||
        user.title.toLowerCase().includes(q) ||
        user.departmentLabel.toLowerCase().includes(q) ||
        user.location.toLowerCase().includes(q)
      );
    });

    // Invited (never-signed-in) accounts always sit at the bottom of activity
    // sorts and the top of oldest-first lists.
    const rank = (user: UserRecord) => {
      if (user.lastActiveMinutes === null) return filters.sort === 'oldest' ? -1 : Number.MAX_SAFE_INTEGER;
      return user.lastActiveMinutes;
    };
    switch (filters.sort) {
      case 'oldest':
        return [...list].sort((a, b) => rank(b) - rank(a));
      case 'name':
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'recent':
      default:
        return [...list].sort((a, b) => rank(a) - rank(b));
    }
  }, [userList, filters]);

  const selectedUser = userList.find((user) => user.id === selectedId) ?? null;
  const drawerUser = userList.find((user) => user.id === drawerId) ?? null;

  const dirty =
    filters.query !== DEFAULT_FILTERS.query ||
    filters.department !== 'all' ||
    filters.role !== 'all' ||
    filters.status !== 'all';

  const resetFilters = () =>
    setFilters((prev) => ({ ...DEFAULT_FILTERS, view: prev.view }));

  /* ---------------- directory interactions ---------------- */

  const openUser = (user: UserRecord) => {
    setSelectedId(user.id);
    setDrawerId(user.id);
  };

  const setStatus = (id: string, status: UserStatus) => {
    setUserList((prev) => prev.map((user) => (user.id === id ? { ...user, status } : user)));
  };

  const handleRowAction = (user: UserRecord, action: UserRowAction) => {
    switch (action) {
      case 'edit':
        setDrawerId(user.id);
        setAddOpen(false);
        flash(`Edit mode opened for ${user.name} (mock — profile drawer)`);
        break;
      case 'reset':
        flash(`Access reset issued for ${user.name} — tokens revoked, credentials rotation queued`);
        break;
      case 'disable':
        setStatus(user.id, 'disabled');
        flash(`${user.name} disabled — console access revoked and audit-logged`);
        break;
      case 'enable':
        setStatus(user.id, 'offline');
        flash(`${user.name} re-enabled — login permitted at next credential rotation`);
        break;
      case 'activity':
        setDrawerId(user.id);
        break;
    }
  };

  const handleProfileAction = (user: UserRecord, action: ProfileAction) => {
    switch (action) {
      case 'edit':
        flash(`Edit form for ${user.name} (mock — fields prefilled from directory)`);
        break;
      case 'reset':
        flash(`Access reset issued for ${user.name} — tokens revoked, credentials rotation queued`);
        break;
      case 'disable':
        setStatus(user.id, 'disabled');
        setDrawerId(null);
        flash(`${user.name} disabled — console access revoked and audit-logged`);
        break;
      case 'activity':
        setDrawerId(user.id);
        break;
    }
  };

  const handleDrawerAction = (user: UserRecord, action: DrawerAction) => {
    switch (action) {
      case 'edit':
        flash(`Edit form for ${user.name} (mock — fields prefilled from directory)`);
        break;
      case 'reset':
        flash(`Access reset issued for ${user.name} — tokens revoked, credentials rotation queued`);
        break;
      case 'disable':
        setStatus(user.id, 'disabled');
        setDrawerId(null);
        flash(`${user.name} disabled — console access revoked and audit-logged`);
        break;
      case 'enable':
        setStatus(user.id, 'offline');
        flash(`${user.name} re-enabled — login permitted at next credential rotation`);
        break;
    }
  };

  /* ---------------- header actions ---------------- */

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 800);
    flash('Directory synced · 56 accounts · 18 operators online');
  };

  const handleImport = () => {
    flash('Bulk import ready — upload a Gujarat Police HR CSV to provision up to 200 operators (mock)');
  };

  const handleExport = () => {
    const header = [
      'employee_id',
      'name',
      'rank',
      'role',
      'department',
      'location',
      'status',
      'email',
      'last_active',
      'assigned_cameras',
      'mfa',
    ];
    const rows = visibleUsers.map((user) =>
      [
        user.employeeId,
        user.name,
        user.rank,
        roleById(user.roleId).name,
        user.departmentLabel,
        user.location,
        user.status,
        user.email,
        user.lastActiveMinutes === null ? 'never' : formatLastActive(user.lastActiveMinutes),
        String(user.assignedCameras),
        user.mfa ? 'enforced' : 'not-enrolled',
      ]
        .map((cell) => (String(cell).includes(',') ? `"${cell}"` : String(cell)))
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gp-users-directory-2026-09-02.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${visibleUsers.length} operator accounts to CSV`);
  };

  const handleCreate = (input: NewUserInput) => {
    const role = roleById(input.roleId);
    const initials = input.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const cameraCount =
      input.cameraScope === 'all'
        ? 0
        : input.cameras.reduce((acc, value) => {
            const option = cameraAssignOptions.find((opt) => opt.value === value);
            const match = option ? /(\d+)\s*cameras/.exec(option.label) : null;
            return acc + (match ? Number(match[1]) : 0);
          }, 0);
    const cameraLabels =
      input.cameraScope === 'all'
        ? ['ALL ZONES']
        : input.cameras.length > 0
          ? input.cameras.map((value) => value.replace('c-', 'C-').toUpperCase())
          : ['—'];

    const newUser: UserRecord = {
      id: input.employeeId,
      name: input.name,
      rank: input.rank,
      employeeId: input.employeeId,
      roleId: input.roleId,
      title: role.name,
      departmentId: input.departmentId,
      departmentLabel: departmentLabel(input.departmentId),
      location: input.location,
      city: input.location.split(',').pop()?.trim() || 'Gujarat',
      status: input.accountState === 'active' ? 'online' : input.accountState === 'invited' ? 'invited' : 'disabled',
      email: input.email,
      phone: input.phone || '—',
      lastActiveMinutes: input.accountState === 'invited' ? null : 0,
      lastLogin: input.accountState === 'invited' ? 'Never — invite pending' : '02 Sep 2026 · just now',
      assignedCameras: cameraCount,
      cameraLabels,
      activeInvestigations: 0,
      alertsHandled: 0,
      mfa: false,
      joined: input.accountState === 'invited' ? 'Invited 02 Sep 2026' : '02 Sep 2026',
      initials,
      hue: userList.length % 12,
      permissions: input.permissions,
    };

    setUserList((prev) => [newUser, ...prev]);
    setSelectedId(newUser.id);
    setAddOpen(false);
    setFilters((prev) => ({ ...prev, status: 'all' }));
    flash(
      input.accountState === 'invited'
        ? `Invitation sent to ${input.name} · ${role.name} · link valid 72 hrs`
        : `${input.name} provisioned as ${role.name} · credentials issued`,
    );
  };

  const pendingInvitations = userList.filter((user) => user.status === 'invited').length;

  return (
    <div className="page">
      <UsersHeader
        refreshing={refreshing}
        syncedAt="10:49 AM"
        pendingInvitations={pendingInvitations}
        onAddUser={() => setAddOpen(true)}
        onRefresh={handleRefresh}
        onImport={handleImport}
        onExport={handleExport}
      />

      <UsersKpiRow
        activeStatus={filters.status === 'online' || filters.status === 'invited' ? (filters.status as UserStatus) : null}
        onFilter={(status) =>
          setFilters((prev) => ({ ...prev, status: status ?? 'all' }))
        }
      />

      <UsersToolbar
        filters={filters}
        onChange={(next) => setFilters(next)}
        onReset={resetFilters}
        dirty={dirty}
        resultCount={visibleUsers.length}
        totalCount={56}
      />

      {/* main workspace: directory + selected-user rail */}
      <div
        className="responsive-band min-h-[520px] grid shrink-0 grid-cols-1 gap-[var(--page-gap)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,356px)]"
      >
        <UserDirectoryTable
          users={visibleUsers}
          totalAccounts={56}
          selectedId={selectedId}
          view={filters.view as ViewMode}
          onViewToggle={(view) => setFilters((prev) => ({ ...prev, view }))}
          onSelect={openUser}
          onAction={handleRowAction}
          onResetFilters={resetFilters}
        />
        <SelectedUserPanel user={selectedUser} onAction={handleProfileAction} />
      </div>

      {/* RBAC roles + permissions */}
      <RolesPermissionsSection onOpenRole={(role) => setRoleMatrix(role)} />

      {/* audit timeline + activity analytics */}
      <div
        className="responsive-band min-h-[360px] grid shrink-0 grid-cols-1 gap-[var(--page-gap)] lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <AccessActivityPanel />
        <UserActivityPanel />
      </div>

      {/* overlays */}
      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={handleCreate} />
      <UserProfileDrawer
        user={drawerUser}
        onClose={() => setDrawerId(null)}
        onAction={handleDrawerAction}
      />
      <RoleMatrixModal role={roleMatrix} onClose={() => setRoleMatrix(null)} />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] animate-flash-in rounded-[6px] border border-accent-purple/50 bg-[#241038] px-3 py-2 text-[12.5px] font-medium text-[#d8b3f7] shadow-[0_0_18px_-4px_rgba(168,85,247,0.6)]">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
