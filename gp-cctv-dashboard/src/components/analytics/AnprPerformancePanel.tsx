import { formatIn, formatPct } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import type { AnprStats } from '@/types/analytics';

interface AnprPerformancePanelProps {
  anpr: AnprStats;
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6d82a3]">{label}</div>
      <div className={`tnum mt-[2px] text-[15px] font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-[3px] truncate text-[10.5px] text-[#7f92b3]">{sub}</div>
    </div>
  );
}

/** Plates processed, successful reads, OCR confidence, unreadable plates. */
export function AnprPerformancePanel({ anpr }: AnprPerformancePanelProps) {
  const successPct = anpr.processed > 0 ? (anpr.successful / anpr.processed) * 100 : 0;
  const unreadPct = anpr.processed > 0 ? (anpr.unreadable / anpr.processed) * 100 : 0;
  const bands = [
    { id: 'high', label: 'High ≥95%', value: anpr.high, color: '#22c55e' },
    { id: 'med', label: 'Medium 85–95%', value: anpr.medium, color: '#2f7dff' },
    { id: 'low', label: 'Low <85%', value: anpr.low, color: '#f59e0b' },
    { id: 'fail', label: 'Unreadable', value: anpr.unreadable, color: '#ef4444' },
  ];
  const bandMax = Math.max(1, ...bands.map((band) => band.value));

  return (
    <Panel
      title="ANPR Performance"
      action={<span className="tnum text-3xs text-accent-green">{anpr.confidence.toFixed(1)}% OCR</span>}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-2 px-3 pb-2 pt-1"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <Metric label="Plates processed" value={formatIn(anpr.processed)} sub="edge ANPR ingest" tone="text-white" />
        <Metric
          label="Successful reads"
          value={formatIn(anpr.successful)}
          sub={`${formatPct(successPct)} hit rate`}
          tone="text-[#6fe0b0]"
        />
        <Metric
          label="OCR confidence"
          value={`${anpr.confidence.toFixed(1)}%`}
          sub={`avg latency ${anpr.latencyMs} ms`}
          tone="text-[#67e8f9]"
        />
        <Metric
          label="Unreadable plates"
          value={formatIn(anpr.unreadable)}
          sub={`${formatPct(unreadPct)} of ingest`}
          tone="text-[#ff8b96]"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-[#6d82a3]">
          <span>Read-quality mix</span>
          <span className="tnum">{formatIn(anpr.processed)} plates</span>
        </div>
        <div className="flex h-[7px] overflow-hidden rounded-full bg-[#0d1626] ring-1 ring-inset ring-edge-soft">
          {bands.map((band) => (
            <span
              key={band.id}
              title={`${band.label}: ${formatIn(band.value)}`}
              style={{
                width: `${(band.value / Math.max(1, anpr.processed)) * 100}%`,
                background: band.color,
              }}
            />
          ))}
        </div>
        <ul className="mt-1.5 space-y-[3px]">
          {bands.map((band) => (
            <li key={band.id} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: band.color }} />
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-[#9fb0cc]">{band.label}</span>
              <span className="relative h-[4px] w-[72px] overflow-hidden rounded-full bg-[#0d1626]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(band.value / bandMax) * 100}%`, background: band.color }}
                />
              </span>
              <span className="tnum w-[42px] text-right text-[11px] font-semibold text-white">{formatIn(band.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
