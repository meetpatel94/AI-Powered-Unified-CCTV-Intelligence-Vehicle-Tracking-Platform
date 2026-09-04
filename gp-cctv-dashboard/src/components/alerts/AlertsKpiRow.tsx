import { AlertTriangle, Bell, CheckCircle2, Gauge, ShieldAlert } from 'lucide-react';

import type { AlertKpi, AlertKpiTone } from '@/types/alerts';
import type { AlertKpis } from '@/data/alertsData';

const toneStyles: Record<AlertKpiTone, { shell: string; label: string; icon: string; foot: string }> = {
  blue: {
    shell: 'from-[#0d2a52] via-[#0b1f3d] to-[#091529] border-[#1d4d8f]',
    label: 'text-[#7fb1f5]',
    icon: 'text-[#4f9dff]',
    foot: 'text-[#6f9ad4]',
  },
  green: {
    shell: 'from-[#0b2e26] via-[#0a2119] to-[#081511] border-[#1d6b52]',
    label: 'text-[#6fe0b0]',
    icon: 'text-[#34d399]',
    foot: 'text-[#4fc48d]',
  },
  orange: {
    shell: 'from-[#3a2408] via-[#2a1a08] to-[#1a1105] border-[#8a5a15]',
    label: 'text-[#f6b95c]',
    icon: 'text-[#f59e0b]',
    foot: 'text-[#e08d3c]',
  },
  red: {
    shell: 'from-[#3d0f16] via-[#2b0c11] to-[#1a070b] border-[#8c2230]',
    label: 'text-[#f79aa4]',
    icon: 'text-[#ef4444]',
    foot: 'text-[#e2707d]',
  },
  yellow: {
    shell: 'from-[#34300a] via-[#26220a] to-[#171406] border-[#7d6f1c]',
    label: 'text-[#eddb6a]',
    icon: 'text-[#eab308]',
    foot: 'text-[#cdb94b]',
  },
  purple: {
    shell: 'from-[#2c123f] via-[#210e30] to-[#150a1f] border-[#6b2ea0]',
    label: 'text-[#d0a4f7]',
    icon: 'text-[#a855f7]',
    foot: 'text-[#bf8ef0]',
  },
};

const kpiIcons = {
  total: Bell,
  critical: AlertTriangle,
  high: Gauge,
  medium: ShieldAlert,
  resolved: CheckCircle2,
} as const;

interface AlertsKpiRowProps {
  kpis: AlertKpis;
  activeKpi: string | null;
  onKpi: (id: AlertKpi['id']) => void;
}

/** Five-card KPI strip; each card doubles as a one-click filter for the feed. */
export function AlertsKpiRow({ kpis, activeKpi, onKpi }: AlertsKpiRowProps) {
  const cards: AlertKpi[] = [
    {
      id: 'total',
      label: 'Total Alerts',
      footnote: `${kpis.unreviewed} unreviewed · ${kpis.total - kpis.resolved - kpis.unreviewed} in progress`,
      tone: 'blue',
      icon: kpiIcons.total,
    },
    {
      id: 'critical',
      label: 'Critical',
      footnote: `${kpis.critical} critical open/recent alerts`, 
      tone: 'red',
      icon: kpiIcons.critical,
    },
    {
      id: 'high',
      label: 'High Priority',
      footnote: `${kpis.high} high priority alerts`, 
      tone: 'orange',
      icon: kpiIcons.high,
    },
    {
      id: 'medium',
      label: 'Medium',
      footnote: `${kpis.medium} medium priority alerts`, 
      tone: 'yellow',
      icon: kpiIcons.medium,
    },
    {
      id: 'resolved',
      label: 'Resolved',
      footnote: `${kpis.resolved} resolved by backend`, 
      tone: 'green',
      icon: kpiIcons.resolved,
    },
  ];

  const values: Record<AlertKpi['id'], number> = {
    total: kpis.total,
    critical: kpis.critical,
    high: kpis.high,
    medium: kpis.medium,
    resolved: kpis.resolved,
  };

  return (
    <div className="grid shrink-0 grid-cols-2 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-5">
      {cards.map((stat) => {
        const tone = toneStyles[stat.tone];
        const Icon = stat.icon;
        const active = activeKpi === stat.id;
        return (
          <button
            key={stat.id}
            type="button"
            onClick={() => onKpi(stat.id)}
            title={`Filter feed: ${stat.label}`}
            className={`relative flex min-h-[104px] flex-col items-start justify-between overflow-hidden rounded-md border bg-gradient-to-br px-4 py-3 text-left transition-all hover:brightness-110 ${tone.shell} ${
              active ? 'ring-1 ring-accent-cyan/70 shadow-glow' : 'ring-0'
            }`}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className={`min-w-0 truncate text-[13px] font-medium ${tone.label}`}>{stat.label}</div>
              <Icon size={30} strokeWidth={1.6} className={`shrink-0 opacity-90 ${tone.icon}`} />
            </div>
            <div className="tnum kpi-value w-full font-bold text-white">{values[stat.id]}</div>
            <div className={`w-full truncate text-[12px] ${tone.foot}`}>{stat.footnote}</div>
            {active ? (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse-dot" />
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
          </button>
        );
      })}
    </div>
  );
}
