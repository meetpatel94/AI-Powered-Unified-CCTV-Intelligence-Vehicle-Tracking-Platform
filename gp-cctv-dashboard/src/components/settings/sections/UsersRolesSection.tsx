import { Fingerprint, KeyRound, ShieldCheck, UserCog } from 'lucide-react';

import {
  NUMERIC_META_OF,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_OPTIONS,
  SECTION_META,
  SETTINGS_ROLE_IDS,
  SETTINGS_ROLE_LABELS,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { SettingValue, UsersRolesConfig } from '@/types/settings';

interface UsersRolesSectionProps {
  cfg: UsersRolesConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'users';

const roleClearance: Record<string, string> = {
  'super-admin': 'Apex · full platform control',
  'command-inspector': 'Senior command · approve ops',
  'investigation-officer': 'Case data + watchlist edits',
  'control-operator': 'Live console · dispatch alerts',
  'traffic-analyst': 'Read + analytics + reports',
  viewer: 'Read-only · no exports',
};

/** Session policy, password/MFA posture and the RBAC permission matrix. */
export function UsersRolesSection({ cfg, patch, pending }: UsersRolesSectionProps) {
  const meta = SECTION_META.users;

  const setPerm = (role: string, perm: string, next: boolean) =>
    patch(`${p}.rolePermissions.${role}.${perm}`, next);

  return (
    <SectionPanel
      id="section-users"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="purple">6 roles · 56 operators</StateChip>}
    >
      <SectionSubhead right="RBAC engine · v2 live">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Access policy
        </span>
      </SectionSubhead>

      <SettingRow
        label="RBAC enforcement"
        hint="Evaluate every console action against the role matrix below. Disabling is not recommended."
      >
        <SettingToggle checked={cfg.rbacEnforced} onChange={(next) => patch(`${p}.rbacEnforced`, next)} label="RBAC enforcement" caption />
      </SettingRow>

      <SettingRow label="Session timeout" hint="Absolute session lifetime before re-authentication is required.">
        <SettingSelect
          ariaLabel="Session timeout"
          value={cfg.sessionTimeoutMin}
          onChange={(next) => patch(`${p}.sessionTimeoutMin`, Number(next))}
          options={[10, 15, 30, 45, 60, 90, 120, 180].map((min) => ({ value: min, label: min >= 60 ? `${min / 60} hour${min > 60 ? 's' : ''}` : `${min} minutes` }))}
        />
      </SettingRow>

      <SettingRow label="Idle auto-lock" hint="Lock the console after inactivity even inside a valid session.">
        <SettingSelect
          ariaLabel="Idle auto-lock"
          value={cfg.idleLockMin}
          onChange={(next) => patch(`${p}.idleLockMin`, Number(next))}
          options={[1, 2, 5, 10, 15, 30, 45, 60].map((min) => ({ value: min, label: min === 1 ? '1 minute' : `${min} minutes` }))}
        />
      </SettingRow>

      <SectionSubhead right="credential lifecycle">
        <span className="flex items-center gap-1.5">
          <KeyRound size={11} />
          Password & MFA
        </span>
      </SectionSubhead>

      <SettingRow label="Password policy" hint="Complexity tier enforced at password set/reset time.">
        <SettingSegmented
          ariaLabel="Password policy"
          value={cfg.passwordPolicy}
          onChange={(next) => patch(`${p}.passwordPolicy`, next)}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'strong', label: 'Strong' },
            { value: 'strict', label: 'Strict' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Password expiry" hint="Operators must rotate credentials after this interval.">
        <SettingSlider
          ariaLabel="Password expiry"
          value={cfg.passwordExpiryDays}
          meta={NUMERIC_META_OF(`${p}.passwordExpiryDays`)}
          onChange={(next) => patch(`${p}.passwordExpiryDays`, next)}
        />
      </SettingRow>

      <SettingRow
        label="Multi-factor authentication"
        hint="TOTP + biometric enforced for every console role. Cannot be disabled below Command level."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SettingToggle checked={cfg.mfaRequired} onChange={(next) => patch(`${p}.mfaRequired`, next)} label="MFA" caption />
          <StateChip tone="green"><Fingerprint size={11} /> 52/56 enrolled</StateChip>
        </div>
      </SettingRow>

      <SettingRow label="Default role for new accounts" hint="Role auto-assigned when operators are provisioned by HR sync.">
        <SettingSelect
          ariaLabel="Default role"
          value={cfg.defaultRole}
          onChange={(next) => patch(`${p}.defaultRole`, next)}
          options={ROLE_OPTIONS}
        />
      </SettingRow>

      <SectionSubhead right="brute-force defence">
        <span className="flex items-center gap-1.5">
          <UserCog size={11} />
          Lockout policy
        </span>
      </SectionSubhead>

      <SettingRow label="Failed attempts before lockout" hint="Consecutive bad logins that freeze the account.">
        <SettingSelect
          ariaLabel="Lockout attempts"
          value={cfg.lockoutAttempts}
          onChange={(next) => patch(`${p}.lockoutAttempts`, Number(next))}
          options={[3, 5, 10].map((attempts) => ({ value: attempts, label: `${attempts} attempts` }))}
        />
      </SettingRow>

      <SettingRow label="Lockout duration" hint="How long the account stays frozen after the threshold is hit.">
        <SettingSlider
          ariaLabel="Lockout duration"
          value={cfg.lockoutDurationMin}
          meta={NUMERIC_META_OF(`${p}.lockoutDurationMin`)}
          onChange={(next) => patch(`${p}.lockoutDurationMin`, next)}
        />
      </SettingRow>

      <SectionSubhead right="click a cell to toggle · mock RBAC">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Role permission matrix
        </span>
      </SectionSubhead>

      <RoleMatrix cfg={cfg} setPerm={setPerm} />
    </SectionPanel>
  );
}

/** Compact roles × permissions matrix. */
function RoleMatrix({
  cfg,
  setPerm,
}: {
  cfg: UsersRolesConfig;
  setPerm: (role: string, perm: string, next: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <table className="w-full min-w-[680px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="border-b border-edge bg-[#0a111f] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              Role
            </th>
            {PERMISSION_KEYS.map((perm) => (
              <th
                key={perm}
                className="border-b border-edge bg-[#0a111f] px-1.5 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint"
              >
                {PERMISSION_LABELS[perm]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SETTINGS_ROLE_IDS.map((role, index) => {
            const elevated = role === 'super-admin' || role === 'command-inspector';
            return (
              <tr key={role} className={index % 2 === 1 ? 'bg-[#0a1120]/60' : ''}>
                <td className="border-b border-edge/40 px-2 py-[7px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border text-[9px] font-black ${
                        elevated
                          ? 'border-accent-purple/40 bg-accent-purple/15 text-accent-purple'
                          : 'border-edge bg-[#101a2e] text-ink-dim'
                      }`}
                    >
                      {role
                        .split('-')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold leading-[14px] text-[#dbe5f4]">
                        {SETTINGS_ROLE_LABELS[role]}
                      </span>
                      <span className="block text-[9.5px] leading-[11px] text-ink-faint">{roleClearance[role]}</span>
                    </span>
                  </div>
                </td>
                {PERMISSION_KEYS.map((perm) => {
                  const active = cfg.rolePermissions[role][perm];
                  return (
                    <td key={perm} className="border-b border-edge/40 px-1.5 py-[7px] text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={`${SETTINGS_ROLE_LABELS[role]} · ${PERMISSION_LABELS[perm]}`}
                        onClick={() => setPerm(role, perm, !active)}
                        title={`${SETTINGS_ROLE_LABELS[role]} · ${PERMISSION_LABELS[perm]}: ${active ? 'granted' : 'denied'}`}
                        className={`mx-auto block h-[18px] w-[30px] rounded-full border transition-all ${
                          active
                            ? 'border-accent-cyan/70 bg-gradient-to-r from-[#0e7490] to-[#155e9e] shadow-[0_0_8px_-2px_rgba(34,211,238,0.8)]'
                            : 'border-edge-strong bg-[#0e1730] hover:border-[#33507e]'
                        }`}
                      >
                        <span
                          className={`block h-[12px] w-[12px] rounded-full transition-all ${
                            active ? 'ml-[15px] bg-[#a5f3fc]' : 'ml-[2px] bg-[#4b5d80]'
                          }`}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-1 pt-1.5 text-[10px] text-ink-faint">
        {PERMISSION_KEYS.length} permission domains · per-role grants shown —{' '}
        <span className="text-[#6fe0b0]">SA</span> role maintains all grants and cannot be removed (
        <span className="tnum">{PERMISSION_KEYS.length}/{PERMISSION_KEYS.length}</span> grants locked)
      </p>
    </div>
  );
}
