import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { activeUsersOverTime, roles, usersByDepartment, usersByRole } from '@/data/usersData';

const roleColors: Record<string, string> = {
  'super-admin': '#a855f7',
  'command-inspector': '#2f7dff',
  'investigation-officer': '#ef4444',
  'traffic-analyst': '#f59e0b',
  'control-room-operator': '#22d3ee',
  viewer: '#7c8db0',
};

const departmentColors = ['#2f7dff', '#ef4444', '#f59e0b', '#22d3ee', '#22c55e', '#a855f7'];

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c8db0]">{children}</h3>
  );
}

/* ---------------- Active users over time (area line) ---------------- */

function ActiveUsersChart() {
  const max = 20;
  const points = activeUsersOverTime.map((point, index) => ({
    x: (index / (activeUsersOverTime.length - 1)) * 100,
    y: 100 - (point.value / max) * 88 - 4,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `0,100 ${line} 100,100`;
  const last = activeUsersOverTime[activeUsersOverTime.length - 1];
  const peak = activeUsersOverTime.reduce((acc, point) => (point.value > acc.value ? point : acc), activeUsersOverTime[0]);

  return (
    <div className="flex min-w-0 flex-col">
      <BlockTitle>Active Users Over Time · 24 h</BlockTitle>
      <div className="relative h-[148px]">
        {/* gridlines */}
        <div className="absolute inset-x-0 bottom-[20px] top-0 flex flex-col justify-between">
          {[20, 15, 10, 5, 0].map((tick) => (
            <div key={tick} className="flex items-center gap-1.5">
              <span className="tnum w-[18px] text-right text-[9.5px] text-[#5c6b87]">{tick}</span>
              <div className="h-px flex-1" style={{ background: '#14243c' }} />
            </div>
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute bottom-[20px] left-[26px] right-0 top-0 h-[calc(100%-20px)] w-[calc(100%-26px)]"
        >
          <defs>
            <linearGradient id="users-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#users-area)" />
          <polyline
            points={line}
            fill="none"
            stroke="#c084fc"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.55))' }}
          />
        </svg>

        <div className="absolute bottom-[20px] left-[26px] right-0 top-0">
          {points.map((point, index) =>
            index % 3 === 0 || index === points.length - 1 ? (
              <span
                key={activeUsersOverTime[index].label}
                className={`absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  index === points.length - 1
                    ? 'bg-white shadow-[0_0_6px_rgba(192,132,252,0.9)]'
                    : 'bg-accent-purple'
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ) : null,
          )}
        </div>

        {/* peak callout */}
        <span className="tnum absolute right-1 top-0 rounded-[3px] border border-accent-purple/40 bg-[#2a1140]/90 px-1 py-px text-[9.5px] font-bold text-[#d0a4f7]">
          peak {peak.value}
        </span>

        {/* x labels */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between pl-[26px]">
          {activeUsersOverTime.map((point, index) =>
            index % 4 === 0 ? (
              <span key={`${point.label}-${index}`} className="tnum text-[9px] text-[#5c6b87]">
                {point.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
        <span className="flex items-center gap-1.5 text-ink-dim">
          <Activity size={11} className="text-accent-purple" />
          <span className="tnum font-bold text-[#d0a4f7]">{last.value} sessions</span> this hour
        </span>
        <span className="text-[#5c6b87]">avg {Math.round(activeUsersOverTime.reduce((a, p) => a + p.value, 0) / activeUsersOverTime.length)} concurrent users</span>
      </div>
    </div>
  );
}

/* ---------------- Users by role (donut) ---------------- */

function UsersByRoleChart() {
  const total = usersByRole.reduce((acc, slice) => acc + slice.count, 0);
  const radius = 15.9155;
  const pcts = usersByRole.map((slice) => (slice.count / total) * 100);
  const offsets = pcts.map((_, index) => 25 - pcts.slice(0, index).reduce((acc, pct) => acc + pct, 0));

  return (
    <div className="flex min-w-0 flex-col">
      <BlockTitle>Users by Role</BlockTitle>
      <div className="flex items-center gap-3">
        <div className="relative h-[118px] w-[118px] shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full">
            <circle cx="21" cy="21" r={radius} fill="none" stroke="#0d1626" strokeWidth="4.6" />
            {usersByRole.map((slice, index) => {
              const pct = pcts[index];
              const dash = `${Math.max(0, pct - 1.2)} ${100 - Math.max(0, pct - 1.2)}`;
              return (
                <circle
                  key={slice.id}
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  stroke={roleColors[slice.id]}
                  strokeWidth="4.6"
                  strokeDasharray={dash}
                  strokeDashoffset={offsets[index]}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="tnum text-[19px] font-bold leading-none text-white">{total}</div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.07em] text-[#6d7f9e]">seats</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1">
          {roles.map((role) => {
            const slice = usersByRole.find((s) => s.id === role.id);
            return (
              <li key={role.id} className="flex items-center gap-1.5 text-[10.5px]">
                <span className="h-[8px] w-[8px] shrink-0 rounded-[2px]" style={{ background: roleColors[role.id] }} />
                <span className="truncate text-[#b8c6dc]">{role.short}</span>
                <span className="tnum ml-auto font-bold text-white">{slice?.count ?? 0}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Users by department (bars) ---------------- */

function UsersByDepartmentChart() {
  const max = Math.max(...usersByDepartment.map((d) => d.count));
  return (
    <div className="flex min-w-0 flex-col">
      <BlockTitle>Users by Department</BlockTitle>
      <div className="space-y-2">
        {usersByDepartment.map((department, index) => (
          <div key={department.id} className="flex items-center gap-2">
            <span className="w-[88px] shrink-0 truncate text-right text-[10.5px] text-[#b8c6dc]">
              {department.short}
            </span>
            <div className="h-[13px] flex-1 overflow-hidden rounded-[3px] bg-[#0c1424]">
              <div
                className="h-full rounded-[3px] transition-all"
                style={{
                  width: `${(department.count / max) * 100}%`,
                  background: `linear-gradient(90deg, ${departmentColors[index]}55, ${departmentColors[index]})`,
                  boxShadow: `0 0 10px -3px ${departmentColors[index]}aa`,
                }}
              />
            </div>
            <span className="tnum w-[20px] shrink-0 text-[11px] font-bold text-white">{department.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-edge-soft pt-1.5 text-[10px] text-[#5c6b87]">
        Headcount across 6 police commands · 56 provisioned accounts
      </div>
    </div>
  );
}

/** USER ACTIVITY analytics: sessions trend + role/department distribution. */
export function UserActivityPanel() {
  return (
    <Panel
      title="User Activity"
      action={<span className="text-3xs text-ink-dim">adoption &amp; seat utilisation</span>}
      className="min-h-0"
      bodyClassName="p-3.5"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActiveUsersChart />
        <UsersByRoleChart />
        <UsersByDepartmentChart />
      </div>
    </Panel>
  );
}
