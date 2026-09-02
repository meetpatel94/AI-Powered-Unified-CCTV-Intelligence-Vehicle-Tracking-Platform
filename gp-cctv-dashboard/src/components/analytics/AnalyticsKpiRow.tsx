import { ArrowDown, ArrowUp, Camera, Car, ScanLine, ShieldAlert, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatIn, formatPct } from '@/components/analytics/chartMath';
import type { AnalyticsKpis } from '@/types/analytics';
import type { AccentTone } from '@/types';

const toneStyles: Record<AccentTone, { shell: string; label: string; icon: string; foot: string }> = {
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
  purple: {
    shell: 'from-[#2c123f] via-[#210e30] to-[#150a1f] border-[#6b2ea0]',
    label: 'text-[#d0a4f7]',
    icon: 'text-[#a855f7]',
    foot: 'text-[#bf8ef0]',
  },
};

interface Card {
  id: string;
  label: string;
  value: string;
  footnote: string;
  tone: AccentTone;
  icon: LucideIcon;
  trend?: 'up' | 'down';
}

interface AnalyticsKpiRowProps {
  kpis: AnalyticsKpis;
}

/** Five-card analytics KPI strip — vehicles, ANPR, AI events, watchlist, cameras. */
export function AnalyticsKpiRow({ kpis }: AnalyticsKpiRowProps) {
  const cards: Card[] = [
    {
      id: 'vehicles',
      label: 'Vehicles Detected',
      value: formatIn(kpis.vehicles),
      footnote: `${kpis.vehiclesDelta >= 0 ? '+' : ''}${kpis.vehiclesDelta.toFixed(1)}% vs previous window`,
      trend: kpis.vehiclesDelta >= 0 ? 'up' : 'down',
      tone: 'green',
      icon: Car,
    },
    {
      id: 'anpr',
      label: 'ANPR Reads',
      value: formatIn(kpis.anpr),
      footnote: `${formatPct(kpis.anprShare)} of vehicles · OCR live`,
      tone: 'blue',
      icon: ScanLine,
    },
    {
      id: 'events',
      label: 'AI Events',
      value: formatIn(kpis.events),
      footnote: `${kpis.eventsOpen} open incidents on this desk`,
      tone: 'orange',
      icon: Sparkles,
    },
    {
      id: 'watchlist',
      label: 'Watchlist Matches',
      value: formatIn(kpis.watchlist),
      footnote: `${kpis.watchlistCritical} critical need action`,
      tone: 'red',
      icon: ShieldAlert,
    },
    {
      id: 'cameras',
      label: 'Active Cameras',
      value: formatIn(kpis.cameras),
      footnote: `${formatPct(kpis.camerasPct, 0)} of ${formatIn(kpis.fleet)} fleet online`,
      tone: 'purple',
      icon: Camera,
    },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-5">
      {cards.map((stat) => {
        const tone = toneStyles[stat.tone];
        const Icon = stat.icon;
        return (
          <article
            key={stat.id}
            className={`relative flex min-h-[104px] flex-col items-start justify-between overflow-hidden rounded-md border bg-gradient-to-br px-4 py-3 ${tone.shell}`}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className={`min-w-0 truncate text-[13px] font-medium ${tone.label}`}>{stat.label}</div>
              <Icon size={30} strokeWidth={1.6} className={`shrink-0 opacity-90 ${tone.icon}`} />
            </div>
            <div className="tnum kpi-value w-full font-bold text-white">{stat.value}</div>
            <div className={`flex w-full items-center gap-1.5 truncate text-[12px] ${tone.foot}`}>
              {stat.trend === 'up' ? <ArrowUp size={11} strokeWidth={3} /> : null}
              {stat.trend === 'down' ? <ArrowDown size={11} strokeWidth={3} /> : null}
              {stat.footnote}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
          </article>
        );
      })}
    </div>
  );
}
