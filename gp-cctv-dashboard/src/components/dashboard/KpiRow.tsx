import { ArrowUp } from 'lucide-react';

import { kpiStats } from '@/data/mockData';
import type { AccentTone, KpiStat } from '@/types';

const toneStyles: Record<
  AccentTone,
  { shell: string; label: string; icon: string; foot: string }
> = {
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

function KpiCard({ stat }: { stat: KpiStat }) {
  const tone = toneStyles[stat.tone];
  const Icon = stat.icon;

  return (
    <article
      className={`relative flex h-[92px] flex-1 items-start justify-between overflow-hidden rounded-md border bg-gradient-to-br px-3.5 py-2.5 ${tone.shell}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className={`text-[11px] font-medium ${tone.label}`}>
          {stat.label}
          {stat.labelSuffix ? <span className="ml-1 text-[10px] opacity-70">{stat.labelSuffix}</span> : null}
        </div>
        <div className="tnum text-[26px] font-bold leading-none tracking-tight text-white">{stat.value}</div>
        <div className={`flex items-center gap-1 text-[10px] ${tone.foot}`}>
          {stat.trend === 'up' && <ArrowUp size={10} strokeWidth={3} />}
          {stat.footnote}
        </div>
      </div>

      <Icon size={30} strokeWidth={1.6} className={`mt-1 shrink-0 opacity-90 ${tone.icon}`} />

      {/* subtle top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
    </article>
  );
}

export function KpiRow() {
  return (
    <div className="flex shrink-0 gap-3">
      {kpiStats.map((stat) => (
        <KpiCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}
