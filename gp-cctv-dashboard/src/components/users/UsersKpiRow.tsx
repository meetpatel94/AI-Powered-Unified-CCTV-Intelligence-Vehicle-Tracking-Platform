import { Crown, ShieldCheck, UserCheck, UsersRound, Wifi, Mail } from 'lucide-react';

import type { UserStatus } from '@/types/users';

interface KpiDef {
  id: string;
  label: string;
  value: string;
  footnote: string;
  icon: typeof UsersRound;
  tone: { shell: string; label: string; icon: string; foot: string };
  filter?: UserStatus;
}

const tones = {
  blue: {
    shell: 'from-[#0d2a52] via-[#0b1f3d] to-[#091529] border-[#1d4d8f]',
    label: 'text-[#7fb1f5]',
    icon: 'text-[#4f9dff]',
    foot: 'text-[#6f9ad4]',
  },
  cyan: {
    shell: 'from-[#083340] via-[#072831] to-[#051a21] border-[#155e75]',
    label: 'text-[#7fe3f2]',
    icon: 'text-[#22d3ee]',
    foot: 'text-[#5fb9c9]',
  },
  green: {
    shell: 'from-[#0b2e26] via-[#0a2119] to-[#081511] border-[#1d6b52]',
    label: 'text-[#6fe0b0]',
    icon: 'text-[#34d399]',
    foot: 'text-[#4fc48d]',
  },
  amber: {
    shell: 'from-[#3a2408] via-[#2a1a08] to-[#1a1105] border-[#8a5a15]',
    label: 'text-[#f6b95c]',
    icon: 'text-[#f59e0b]',
    foot: 'text-[#e08d3c]',
  },
  purple: {
    shell: 'from-[#2c123f] via-[#210e30] to-[#150a1f] border-[#6b2ea0]',
    label: 'text-[#d0a4f7]',
    icon: 'text-[#a855f7]',
    foot: 'text-[#bf8ef0]',
  },
};

const kpis: KpiDef[] = [
  {
    id: 'total',
    label: 'Total Users',
    value: '56',
    footnote: 'Across 6 police commands',
    icon: UsersRound,
    tone: tones.blue,
  },
  {
    id: 'online',
    label: 'Online Now',
    value: '18',
    footnote: 'Operators on console',
    icon: Wifi,
    tone: tones.green,
    filter: 'online',
  },
  {
    id: 'active',
    label: 'Active Users',
    value: '52',
    footnote: '4 accounts disabled',
    icon: UserCheck,
    tone: tones.cyan,
  },
  {
    id: 'pending',
    label: 'Pending Invitations',
    value: '4',
    footnote: 'Expire in 72 hrs',
    icon: Mail,
    tone: tones.amber,
    filter: 'invited',
  },
  {
    id: 'admins',
    label: 'Administrators',
    value: '6',
    footnote: 'Level-4 clearance',
    icon: ShieldCheck,
    tone: tones.purple,
  },
];

interface UsersKpiRowProps {
  activeStatus: UserStatus | null;
  onFilter: (status: UserStatus | null) => void;
}

/** Access-control KPI strip; cards act as quick status filters. */
export function UsersKpiRow({ activeStatus, onFilter }: UsersKpiRowProps) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const interactive = Boolean(kpi.filter);
        const isActive = interactive && activeStatus === kpi.filter;
        return (
          <button
            key={kpi.id}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onFilter(isActive ? null : (kpi.filter ?? null))}
            className={`relative flex min-h-[104px] flex-col items-start justify-between overflow-hidden rounded-md border bg-gradient-to-br px-4 py-3 text-left transition-all ${kpi.tone.shell} ${
              interactive ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
            } ${isActive ? 'ring-2 ring-accent-blue/70 shadow-glow' : ''}`}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className={`min-w-0 text-[12.5px] font-medium leading-snug ${kpi.tone.label}`}>
                {kpi.label}
              </div>
              <Icon size={28} strokeWidth={1.6} className={`shrink-0 opacity-90 ${kpi.tone.icon}`} />
            </div>
            <div className="tnum kpi-value w-full font-bold text-white">{kpi.value}</div>
            <div className={`flex items-center gap-1.5 text-[11.5px] leading-snug ${kpi.tone.foot}`}>
              {kpi.id === 'admins' ? <Crown size={10} strokeWidth={3} /> : null}
              {kpi.footnote}
              {interactive ? (
                <span
                  className={`ml-auto rounded-[3px] px-1 text-[10px] font-bold uppercase tracking-wide ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'
                  }`}
                >
                  {isActive ? 'filtered' : 'filter'}
                </span>
              ) : null}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
          </button>
        );
      })}
    </div>
  );
}
