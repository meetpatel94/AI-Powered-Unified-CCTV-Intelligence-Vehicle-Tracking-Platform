import {
  Activity,
  AlertTriangle,
  Brain,
  FileText,
  Gauge,
  MapPin,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Panel } from '@/components/common/Panel';
import type { InsightCard, InsightTone, UnusualEvent } from '@/types/analytics';

interface IntelligenceSummaryPanelProps {
  insights: InsightCard[];
  unusual: UnusualEvent[];
  generatedAt: string;
  onViewReport: () => void;
}

const toneShell: Record<InsightTone, { border: string; kicker: string; icon: string; glow: string }> = {
  cyan: { border: 'border-accent-cyan/30', kicker: 'text-accent-cyan', icon: 'text-accent-cyan', glow: 'bg-accent-cyan/10' },
  blue: { border: 'border-accent-blue/30', kicker: 'text-[#7fb1f5]', icon: 'text-[#4f9dff]', glow: 'bg-accent-blue/10' },
  green: { border: 'border-accent-green/30', kicker: 'text-[#6fe0b0]', icon: 'text-[#34d399]', glow: 'bg-accent-green/10' },
  orange: { border: 'border-accent-orange/30', kicker: 'text-[#f6b95c]', icon: 'text-[#f59e0b]', glow: 'bg-accent-orange/10' },
  red: { border: 'border-accent-red/30', kicker: 'text-[#ff8b96]', icon: 'text-[#ef4444]', glow: 'bg-accent-red/10' },
  purple: { border: 'border-accent-purple/30', kicker: 'text-[#d0a4f7]', icon: 'text-[#a855f7]', glow: 'bg-accent-purple/10' },
};

const insightIcon: Record<string, LucideIcon> = {
  peak: Gauge,
  location: MapPin,
  alert: AlertTriangle,
  anpr: ScanLine,
  mix: Activity,
};

const unusualDot: Record<InsightTone, string> = {
  cyan: 'bg-accent-cyan',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  orange: 'bg-accent-orange',
  red: 'bg-accent-red',
  purple: 'bg-accent-purple',
};

/** Auto-generated mock intelligence briefing + unusual-activity rail. */
export function IntelligenceSummaryPanel({
  insights,
  unusual,
  generatedAt,
  onViewReport,
}: IntelligenceSummaryPanelProps) {
  const navigate = useNavigate();

  return (
    <Panel
      title="Intelligence Summary"
      action={
        <button
          type="button"
          onClick={onViewReport}
          className="flex h-[26px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-2.5 text-[12px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <FileText size={11} />
          View Detailed Report
        </button>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-2 px-3 pb-2.5 pt-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10.5px] text-[#6d82a3]">
        <span className="flex items-center gap-1.5">
          <Brain size={11} className="text-accent-purple" />
          Auto-generated · model gp-intel-v2.4 · {generatedAt}
        </span>
        <span className="flex items-center gap-1 text-accent-purple">
          <Sparkles size={10} />
          operator desk only · not for evidential use
        </span>
      </div>

      {/* Insight cards: five across on large desktops, collapsing to 3 / 2 / 1
          on narrower widths so no card gets cramped. */}
      <div className="grid min-h-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {insights.map((card) => {
          const tone = toneShell[card.tone];
          const Icon = insightIcon[card.id] ?? Sparkles;
          return (
            <article
              key={card.id}
              className={`flex min-w-0 flex-col rounded-[6px] border bg-[#0c1424] px-2.5 py-2 ${tone.border}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${tone.kicker}`}>{card.kicker}</span>
                <span className={`grid h-[18px] w-[18px] place-items-center rounded-[4px] ${tone.glow}`}>
                  <Icon size={11} className={tone.icon} />
                </span>
              </div>
              <div className="mt-1 truncate text-[12px] font-bold leading-tight text-white">{card.title}</div>
              <div className={`tnum mt-[2px] text-[15px] font-bold leading-none ${tone.kicker}`}>{card.metric}</div>
              <p className="mt-1.5 line-clamp-3 text-[11px] leading-[13px] text-[#8ea1c0]">{card.body}</p>
            </article>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 rounded-[6px] border border-edge bg-[#0c1424] px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#d0a4f7]">Unusual activity indicators</span>
          <span className="tnum text-[10.5px] text-[#6d82a3]">{unusual.length} flags this window</span>
        </div>
        {unusual.length === 0 ? (
          <div className="py-2 text-[12px] text-ink-dim">No unusual indicators in the current filter.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 lg:grid-cols-2">
            {unusual.map((event) => (
              <li key={event.id} className="flex min-w-0 items-start gap-2">
                <span className="tnum w-[34px] shrink-0 pt-[1px] text-[11px] font-semibold text-[#8ea1c0]">{event.time}</span>
                <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${unusualDot[event.tone]}`} />
                <span className="min-w-0 flex-1 text-[12px] leading-[14px] text-[#c3cfe2]">
                  {event.text}
                  {event.camera ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/live-view?camera=${event.camera}`)}
                      className="ml-1.5 text-[11px] font-semibold text-accent-blue hover:text-cyan-300"
                    >
                      {event.camera}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
