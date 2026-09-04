import { useMemo, useState } from 'react';
import {
  AtSign,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  IdCard,
  MapPin,
  Phone,
  ShieldCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';

import { cameraAssignOptions, departmentLabel, departments, roleAccent, roleById, roles, PERMISSIONS } from '@/data/usersData';
import { fieldLabel, inputCls, PermDot } from '@/components/users/userTones';
import type { AccountState, NewUserInput, PermissionKey, PermissionLevel, RoleId } from '@/types/users';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewUserInput) => void;
}

const accountOptions: Array<{ id: AccountState; label: string; hint: string }> = [
  { id: 'active', label: 'Active', hint: 'Credentials issued now' },
  { id: 'invited', label: 'Invited', hint: 'Email invite · 72 hr link' },
  { id: 'disabled', label: 'Disabled', hint: 'Provisioned, no login' },
];

/** Polished provisioning form: identity, post, role, cameras, permissions, status. */
export function AddUserModal({ open, onClose, onCreate }: AddUserModalProps) {
  const [name, setName] = useState('');
  const [rank, setRank] = useState('Constable');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<RoleId>('control-room-operator');
  const [departmentId, setDepartmentId] = useState('control-room');
  const [location, setLocation] = useState('');
  const [cameraScope, setCameraScope] = useState<'all' | 'selected'>('selected');
  const [cameras, setCameras] = useState<string[]>([]);
  const [accountState, setAccountState] = useState<AccountState>('invited');
  const [permissionOverrides, setPermissionOverrides] = useState<Partial<Record<PermissionKey, PermissionLevel>>>({});

  const role = roleById(roleId);
  const accent = roleAccent[role.accent];

  const levelFor = (key: PermissionKey): PermissionLevel =>
    permissionOverrides[key] ?? role.permissions[key];

  const cyclePermission = (key: PermissionKey) => {
    const order: PermissionLevel[] = ['full', 'partial', 'none'];
    const current = levelFor(key);
    const next = order[(order.indexOf(current) + 1) % order.length];
    setPermissionOverrides((prev) => ({ ...prev, [key]: next }));
  };

  const toggleCamera = (value: string) =>
    setCameras((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const valid = useMemo(
    () =>
      name.trim().length >= 4 &&
      employeeId.trim().length >= 4 &&
      email.trim().includes('@') &&
      location.trim().length >= 3,
    [name, employeeId, email, location],
  );

  if (!open) return null;

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(),
      rank: rank.trim(),
      employeeId: employeeId.trim().toUpperCase(),
      email: email.trim(),
      phone: phone.trim(),
      roleId,
      departmentId,
      location: location.trim(),
      cameraScope,
      cameras: cameraScope === 'all' ? ['ALL ZONES'] : cameras,
      accountState,
      permissions: Object.fromEntries(PERMISSIONS.map((p) => [p.key, levelFor(p.key)])) as Record<
        PermissionKey,
        PermissionLevel
      >,
    });
    setName('');
    setEmployeeId('');
    setEmail('');
    setPhone('');
    setLocation('');
    setCameras([]);
    setPermissionOverrides({});
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close add user form"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-[720px] max-w-[95vw] flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-drawer-in">
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border border-accent-purple/40 bg-accent-purple/15">
              <UserPlus size={17} className="text-accent-purple" />
            </span>
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">Provision New User</h2>
              <p className="mt-[1px] text-[11.5px] text-ink-dim">
                Access is granted through role-based permissions and logged to the audit trail
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
          {/* ---- identity ---- */}
          <section className="space-y-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#7c8db0]">Operator Identity</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label className={fieldLabel}>Full Name *</label>
                <div className="relative">
                  <UserRound size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mahesh Chavda"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className={fieldLabel}>Rank / Designation</label>
                <input
                  type="text"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="Inspector / PSI / Constable"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Employee / Operator ID *</label>
                <div className="relative">
                  <IdCard size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="GP-OP-0264"
                    className={`${inputCls} pl-8 font-mono`}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Email *</label>
                <div className="relative">
                  <AtSign size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gujpolice.gov.in"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Phone</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98xxx xxxxx"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ---- post / role ---- */}
          <section className="mt-4 space-y-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#7c8db0]">Posting &amp; Role</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Role *</label>
                <select
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value as RoleId);
                    setPermissionOverrides({});
                  }}
                  className={`${inputCls} appearance-none`}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Department</label>
                <div className="relative">
                  <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className={`${inputCls} appearance-none pl-8`}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.short}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Command / Location *</label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Vadodara City Control Room"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
            </div>

            <div
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[12px] ${accent.chip}`}
            >
              <role.icon size={15} className={accent.icon} />
              <span className={`font-semibold ${accent.text}`}>{role.name}</span>
              <span className="text-ink-dim">· {departmentLabel(departmentId)}</span>
              <span className="ml-auto flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-dim">
                <BadgeCheck size={12} className={accent.icon} /> {role.clearance}
              </span>
            </div>
          </section>

          {/* ---- cameras ---- */}
          <section className="mt-4 space-y-2">
            <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#7c8db0]">
              <Camera size={12} /> Assigned Cameras
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(['all', 'selected'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setCameraScope(scope)}
                  className={`flex h-[38px] items-center justify-center gap-2 rounded-[5px] border text-[12.5px] font-semibold transition-colors ${
                    cameraScope === scope
                      ? 'border-accent-blue/70 bg-accent-blue/15 text-[#9fc7ff]'
                      : 'border-edge bg-[#0c1424] text-[#8ea3c4] hover:border-edge-strong hover:text-white'
                  }`}
                >
                  {scope === 'all' ? 'All backend-registered zones' : 'Selected camera clusters'}
                </button>
              ))}
            </div>
            {cameraScope === 'selected' ? (
              <div className="grid max-h-[132px] grid-cols-1 gap-1 overflow-y-auto rounded-md border border-edge p-1.5 sm:grid-cols-2">
                {cameraAssignOptions.map((option) => {
                  const checked = cameras.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCamera(option.value)}
                      className={`flex items-center gap-2 rounded-[4px] border px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                        checked
                          ? 'border-accent-blue/60 bg-accent-blue/10 text-[#cfe0ff]'
                          : 'border-transparent bg-[#0c1424] text-[#b8c6dc] hover:border-edge-strong'
                      }`}
                    >
                      <span
                        className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border ${
                          checked ? 'border-accent-blue bg-accent-blue text-white' : 'border-edge-strong'
                        }`}
                      >
                        {checked ? <Check size={10} strokeWidth={3.5} /> : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {/* ---- permissions ---- */}
          <section className="mt-4 space-y-2">
            <h3 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#7c8db0]">
              <ShieldCheck size={12} /> Module Permissions
              <span className="ml-auto font-medium normal-case tracking-normal text-[#5c6b87]">
                inherited from {role.short} · click to override
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {PERMISSIONS.map((perm) => {
                const level = levelFor(perm.key);
                const overridden = permissionOverrides[perm.key] !== undefined;
                const PIcon = perm.icon;
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => cyclePermission(perm.key)}
                    title={`${perm.label}: ${level} — click to cycle`}
                    className={`flex flex-col items-center gap-1 rounded-[5px] border px-1.5 py-2 transition-all ${
                      level === 'full'
                        ? 'border-accent-green/40 bg-accent-green/[0.08]'
                        : level === 'partial'
                          ? 'border-accent-orange/40 bg-accent-orange/[0.08]'
                          : 'border-edge bg-[#0c1424]'
                    } ${overridden ? 'ring-1 ring-accent-blue/60' : ''}`}
                  >
                    <PIcon size={14} className={level === 'none' ? 'text-[#65799b]' : level === 'full' ? 'text-[#6fe0b0]' : 'text-[#f6b95c]'} />
                    <span className="text-[10.5px] font-semibold leading-tight text-[#c3cfe2]">{perm.label}</span>
                    <PermDot level={level} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- account state ---- */}
          <section className="mt-4 space-y-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#7c8db0]">Account Status</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {accountOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccountState(option.id)}
                  className={`rounded-[5px] border px-2.5 py-2 text-left transition-colors ${
                    accountState === option.id
                      ? 'border-accent-blue/70 bg-accent-blue/15'
                      : 'border-edge bg-[#0c1424] hover:border-edge-strong'
                  }`}
                >
                  <div
                    className={`text-[12px] font-bold ${
                      accountState === option.id ? 'text-[#9fc7ff]' : 'text-[#c3cfe2]'
                    }`}
                  >
                    {option.label}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-ink-dim">{option.hint}</div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-edge px-4 py-2.5">
          <span className="text-[11px] text-[#5c6b87]">
            {valid ? 'Ready to provision — action will be audit-logged' : 'Fill the required fields marked *'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-[32px] items-center rounded-[5px] border border-edge bg-[#0c1424] px-4 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={submit}
              className="flex h-[32px] items-center gap-1.5 rounded-[5px] border border-[#7d3fc8] bg-gradient-to-r from-[#8b3fe8] to-[#6d28d9] px-4 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(168,85,247,0.9)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <UserPlus size={14} strokeWidth={2.4} />
              {accountState === 'invited' ? 'Send Invitation' : 'Create User'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
