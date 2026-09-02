import { BellRing, CalendarClock, FileCheck2, FileClock, FileText, Siren } from 'lucide-react';

import { reportKpis } from '@/data/reportsData';

interface KpiCard {
  id: string;
  label: string;
  value: number;
  hint: string;
  color: string;
  icon: typeof FileText;
  sharePct: number;
}

/** Five-card KPI strip for the report registry. */
export function ReportsKpiRow({ extraGenerated = 0 }: { extraGenerated?: number }) {
  const cards: KpiCard[] = [
    {
      id: 'generated',
      label: 'Reports Generated',
      value: reportKpis.generated + extraGenerated,
      hint: 'Last 30 days · all commands · +12 today',
      color: '#22d3ee',
      icon: FileText,
      sharePct: 100,
    },
    {
      id: 'pending',
      label: 'Pending Reports',
      value: reportKpis.pending,
      hint: 'Queued or rendering on the report engine',
      color: '#f59e0b',
      icon: FileClock,
      sharePct: 12,
    },
    {
      id: 'investigation',
      label: 'Investigation Reports',
      value: reportKpis.investigation,
      hint: 'Case-grade journey & dossier documents',
      color: '#a855f7',
      icon: Siren,
      sharePct: 33,
    },
    {
      id: 'alert',
      label: 'Alert Reports',
      value: reportKpis.alert,
      hint: 'Severity digests & escalation reviews',
      color: '#ef4444',
      icon: BellRing,
      sharePct: 45,
    },
    {
      id: 'scheduled',
      label: 'Scheduled Reports',
      value: reportKpis.scheduled,
      hint: 'Active recurring jobs · next run 18:00 IST',
      color: '#22c55e',
      icon: CalendarClock,
      sharePct: 18,
    },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.id === 'generated' ? FileCheck2 : card.icon;
        return (
          <div
            key={card.id}
            title={card.hint}
            className="group panel relative min-h-[104px] overflow-hidden px-3.5 py-3 transition-colors hover:bg-panel-hover/60"
          >
            <span
              className="absolute inset-x-0 top-0 h-[2px] opacity-70"
              style={{ background: `linear-gradient(90deg, ${card.color}, transparent 85%)` }}
            />
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.11em] text-ink-dim">
                {card.label}
              </span>
              <span
                className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[4px] border"
                style={{ borderColor: `${card.color}44`, backgroundColor: `${card.color}14`, color: card.color }}
              >
                <Icon size={13} strokeWidth={2.2} />
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum kpi-value font-bold text-white">{card.value.toLocaleString('en-IN')}</span>
            </div>

            <p className="mt-2 truncate text-[13px] text-ink-faint">{card.hint}</p>

            <span className="mt-2.5 block h-[4px] overflow-hidden rounded-full bg-[#111c30]">
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${card.sharePct}%`,
                  backgroundColor: card.color,
                  boxShadow: `0 0 8px -1px ${card.color}`,
                }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
