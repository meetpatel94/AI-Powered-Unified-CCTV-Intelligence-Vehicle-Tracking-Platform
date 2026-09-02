import { Panel } from '@/components/common/Panel';
import type { AlertRecord } from '@/types/alerts';
import { computeTypeBars } from '@/data/alertsData';

interface AlertsByTypePanelProps {
  alerts: AlertRecord[];
}

/** Bottom row 1: incidents grouped by detection type (horizontal bars). */
export function AlertsByTypePanel({ alerts }: AlertsByTypePanelProps) {
  const bars = computeTypeBars(alerts);
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <Panel
      title="Alerts by Type"
      action={<span className="tnum text-3xs text-ink-dim">today · {alerts.length} events</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col justify-between px-3 pb-2 pt-1"
    >
      {bars.map((bar, index) => (
        <div key={bar.id} className="group flex items-center gap-2" style={{ animationDelay: `${index * 40}ms` }}>
          <span className="w-[104px] shrink-0 truncate text-[11px] font-medium text-[#9fb0cc] transition-colors group-hover:text-white">
            {bar.label}
          </span>
          <span className="relative h-[11px] flex-1 overflow-hidden rounded-[2px] bg-[#0d1626] ring-1 ring-inset ring-edge-soft">
            <span
              className="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-500"
              style={{
                width: `${(bar.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${bar.color}55 0%, ${bar.color} 100%)`,
                boxShadow: `0 0 10px -2px ${bar.color}`,
              }}
            />
          </span>
          <span className="tnum w-[18px] shrink-0 text-right text-[12px] font-bold text-white">{bar.value}</span>
        </div>
      ))}
    </Panel>
  );
}
