import type { LucideIcon } from 'lucide-react';

/**
 * Users & Access Control domain types.
 *
 * Frontend mock-data only for now. The shapes are intentionally aligned with
 * a future auth/RBAC service: `RoleDef.permissions` is the matrix an RBAC
 * policy engine would evaluate, `UserRecord` carries audit fields (lastLogin,
 * mfa) and `AccessEvent` is the shape of an audit-log feed entry.
 */

export type UserStatus = 'online' | 'away' | 'offline' | 'disabled' | 'invited';

/** Account state surfaced by the Add User form. */
export type AccountState = 'active' | 'invited' | 'disabled';

export type RoleId =
  | 'super-admin'
  | 'command-inspector'
  | 'investigation-officer'
  | 'traffic-analyst'
  | 'control-room-operator'
  | 'viewer';

export type PermissionKey =
  | 'dashboard'
  | 'liveCameras'
  | 'cameraMap'
  | 'vehicleSearch'
  | 'watchlist'
  | 'alerts'
  | 'investigation'
  | 'reports'
  | 'cameraHealth'
  | 'userManagement';

/** full = granted, partial = scoped/read-only, none = denied. */
export type PermissionLevel = 'full' | 'partial' | 'none';

export interface RoleDef {
  id: RoleId;
  name: string;
  short: string;
  icon: LucideIcon;
  /** Purple role accents for admin, semantic tones for the rest. */
  accent: 'purple' | 'blue' | 'red' | 'amber' | 'cyan' | 'slate';
  clearance: string;
  description: string;
  /** Platform-wide seat count for the role (mock). */
  userCount: number;
  permissions: Record<PermissionKey, PermissionLevel>;
}

export interface UserRecord {
  id: string;
  name: string;
  rank: string;
  employeeId: string;
  roleId: RoleId;
  /** Functional job title, e.g. "Control Room Operator". */
  title: string;
  departmentId: string;
  departmentLabel: string;
  /** Command / post the operator is attached to. */
  location: string;
  city: string;
  status: UserStatus;
  email: string;
  phone: string;
  /** Minutes since last activity; null when the account has never signed in. */
  lastActiveMinutes: number | null;
  lastLogin: string;
  assignedCameras: number;
  cameraLabels: string[];
  activeInvestigations: number;
  alertsHandled: number;
  mfa: boolean;
  joined: string;
  initials: string;
  /** Index into the avatar palette. */
  hue: number;
  /** Optional per-user override of the role permission matrix. */
  permissions?: Partial<Record<PermissionKey, PermissionLevel>>;
}

export type AccessEventType =
  | 'login'
  | 'logout'
  | 'permission-change'
  | 'report-export'
  | 'watchlist-update'
  | 'investigation'
  | 'invite'
  | 'reset'
  | 'disable';

export interface AccessEvent {
  id: string;
  type: AccessEventType;
  label: string;
  detail: string;
  userId: string;
  userName: string;
  time: string;
  minutesAgo: number;
}

export interface NewUserInput {
  name: string;
  rank: string;
  employeeId: string;
  email: string;
  phone: string;
  roleId: RoleId;
  departmentId: string;
  location: string;
  cameraScope: 'all' | 'selected';
  cameras: string[];
  accountState: AccountState;
  permissions: Record<PermissionKey, PermissionLevel>;
}
