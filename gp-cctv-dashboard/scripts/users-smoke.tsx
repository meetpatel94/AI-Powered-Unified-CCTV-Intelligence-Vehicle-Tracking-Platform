/* Dev-only runtime smoke check: renders the Users & Roles screen (page +
   profile drawer + add-user modal + role matrix) through react-dom/server so
   every new component's render path runs.
   Usage: npx vite build --ssr scripts/users-smoke.tsx --outDir /tmp/users-ssr --emptyOutDir && node /tmp/users-ssr/users-smoke.js */
import { renderToString } from 'react-dom/server';

import { AddUserModal } from '@/components/users/AddUserModal';
import { RoleMatrixModal } from '@/components/users/RoleMatrixModal';
import { AccessActivityPanel } from '@/components/users/AccessActivityPanel';
import { RolesPermissionsSection } from '@/components/users/RolesPermissionsSection';
import { SelectedUserPanel } from '@/components/users/SelectedUserPanel';
import { UserActivityPanel } from '@/components/users/UserActivityPanel';
import { UserDirectoryTable } from '@/components/users/UserDirectoryTable';
import { UserProfileDrawer } from '@/components/users/UserProfileDrawer';
import { roleById, users } from '@/data/usersData';
import { Users } from '@/pages/Users';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

const page = renderToString(<Users />);

/* page chrome */
assert(page.includes('USERS &amp; ROLES') || page.includes('Users &amp; Roles'), 'page title');
assert(page.includes('Manage operators, permissions and system access'), 'subtitle');
assert(page.includes('+ Add User'), 'add user action');
assert(page.includes('Import') && page.includes('Export') && page.includes('Refresh'), 'header actions');

/* KPIs */
assert(page.includes('Total Users') && page.includes('>56<'), 'KPI total 56');
assert(page.includes('Online Now') && page.includes('>18<'), 'KPI online 18');
assert(page.includes('Active Users') && page.includes('>52<'), 'KPI active 52');
assert(page.includes('Pending Invitations') && page.includes('>4<'), 'KPI invites 4');
assert(page.includes('Administrators') && page.includes('>6<'), 'KPI admins 6');

/* toolbar */
assert(page.includes('Search by Name / Email / Role...'), 'search box');
assert(page.includes('All Departments') && page.includes('All Roles') && page.includes('All Statuses'), 'filter dropdowns');
assert(page.includes('Last Active: Recent'), 'last-active sort');
assert(page.includes('User Directory'), 'directory panel');

/* table columns */
for (const col of ['Operator', 'Role', 'Department', 'Location', 'Status', 'Last Active', 'Permissions', 'Actions']) {
  assert(page.includes(col), `table column ${col}`);
}

/* required users */
assert(page.includes('Rajveer Singh Jadeja'), 'Inspector Rajveer');
assert(page.includes('Priya Desai'), 'control room operator');
assert(page.includes('Kartik Shah'), 'traffic analyst');
assert(page.includes('Hardik Solanki'), 'investigation officer');
assert(page.includes('Nisha Parmar') || page.includes('Vikram Rathod'), 'system administrator');
assert(page.includes('Rohan Bhatt'), 'camera monitoring operator');

/* states */
assert(page.includes('Online'), 'online state');
assert(page.includes('Invited'), 'pending/invited state');
assert(page.includes('Disabled'), 'disabled state');

/* selected user rail */
assert(page.includes('Selected User'), 'selected user panel');
assert(page.includes('Permission Summary'), 'permission summary');
assert(page.includes('Edit User') && page.includes('Reset Access') && page.includes('Disable User') && page.includes('View Activity'), 'profile actions');

/* roles section */
assert(page.includes('Roles &amp; Permissions') || page.includes('Roles & Permissions'), 'roles section');
for (const role of [
  'Super Administrator',
  'Command Inspector',
  'Investigation Officer',
  'Traffic Analyst',
  'Control Room Operator',
  'Viewer',
]) {
  assert(page.includes(role), `role card ${role}`);
}

/* modules */
for (const mod of ['Dashboard', 'Live Cameras', 'Camera Map', 'Vehicle Search', 'Watchlist', 'Alerts', 'Investigation', 'Reports', 'Camera Health', 'User Management']) {
  assert(page.includes(mod), `permission module ${mod}`);
}

/* timeline + analytics */
assert(page.includes('Recent Access Activity'), 'audit timeline');
assert(page.includes('Permissions updated') || page.includes('Console login'), 'audit events');
assert(page.includes('User Activity'), 'activity panel');
assert(page.includes('Active Users Over Time'), 'active users chart');
assert(page.includes('Users by Role'), 'users by role chart');
assert(page.includes('Users by Department'), 'users by department chart');

/* sub-components render independently */
const drawer = renderToString(
  <UserProfileDrawer user={users[0]} onClose={() => undefined} onAction={() => undefined} />,
);
assert(drawer.includes('Operator Profile') && drawer.includes('Effective Permissions'), 'profile drawer');

const rail = renderToString(
  <SelectedUserPanel user={users[0]} onAction={() => undefined} />,
);
assert(rail.includes('Assigned') || rail.includes('Cameras'), 'rail stats');

const matrix = renderToString(
  <RoleMatrixModal role={roleById('super-admin')} onClose={() => undefined} />,
);
assert(matrix.includes('Module permissions') && matrix.includes('Clearance Level 4'), 'role matrix modal');

const addModal = renderToString(
  <AddUserModal open onClose={() => undefined} onCreate={() => undefined} />,
);
assert(addModal.includes('Provision New User') && addModal.includes('Employee / Operator ID'), 'add user modal');
assert(addModal.includes('Assigned Cameras') && addModal.includes('Account Status'), 'add modal sections');

const directory = renderToString(
  <UserDirectoryTable
    users={users}
    totalAccounts={56}
    selectedId={users[0].id}
    view="grid"
    onViewToggle={() => undefined}
    onSelect={() => undefined}
    onAction={() => undefined}
    onResetFilters={() => undefined}
  />,
);
assert(directory.includes('Table view') && directory.includes('Grid view'), 'grid view renders');

const rolesSection = renderToString(<RolesPermissionsSection onOpenRole={() => undefined} />);
assert(rolesSection.includes('RBAC roles'), 'roles section header');

const activity = renderToString(<AccessActivityPanel />);
assert(activity.includes('audit log'), 'activity panel live label');

const analytics = renderToString(<UserActivityPanel />);
assert(analytics.includes('sessions') || analytics.includes('concurrent users'), 'analytics copy');

if (failed > 0) {
  console.error(`\n${failed} smoke assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll Users & Roles smoke assertions passed');
