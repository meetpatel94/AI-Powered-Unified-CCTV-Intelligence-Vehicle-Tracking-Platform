import { formatIn, formatPct } from '@/components/analytics/chartMath';
import { Panel } from '@/components/common/Panel';
import { useNavigate } from 'react-router-dom';
import type { AnprStats, CameraActivityRow, UnusualEvent } from '@/types/analytics';

interface CameraActivityInsightsPanelProps {
  cameras: CameraActivityRow[];
  anpr: AnprStats;
  unusual: UnusualEvent[];
  peakLabel: string;
  peakValue: number;
  peakUnit: 'hour' | 'day';
  onSelectCamera: (code: string) => void;
}

const statusDot: Record<CameraActivityRow['status'], string> = {
  online: 'bg-accent-green',
  warning: 'bg-accent-orange',
  critical: 'bg-accent-red animate-pulse-dot',
  offline: 'bg-[#64748b]',
};

const unusualDot: Record<UnusualEvent['tone'], string> = {
  cyan: 'bg-accent-cyan',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  orange: 'bg-accent-orange',
  red: 'bg-accent-red',
  purple: 'bg-accent-purple',
};

function AnprStat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
      <div className="truncate text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#6d82a3]">{label}</div>
      <div className={`tnum mt-[2px] text-[15px] font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-[3px] truncate text-[10px] text-[#7f92b3]">{sub}</div>
    </div>
  );
}

function SectionLabel({ children, note }: { children: string; note?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6d82a3]">{children}</span>
      {note ? <span className="tnum truncate text-[10px] text-[#6d82a3]">{note}</span> : null}
    </div>
  );
}

/**
 * Compact right-column companion to Vehicle Type Distribution: the camera /
 * detection intelligence that survives the analytics reorganisation — ANPR
 * read quality, the most-active camera ranking and unusual-activity flags.
 */
export function CameraActivityInsightsPanel({
  cameras,
  anpr,
  unusual,
  peakLabel,
  peakValue,
  peakUnit,
  onSelectCamera,
}: CameraActivityInsightsPanelProps) {
  const navigate = useNavigate();
  const successPct = anpr.processed > 0 ? (anpr.successful / anpr.processed) * 100 : 0;
  const top = cameras.slice(0, 6);
  const max = Math.max(1, cameras[0]?.detections ?? 1);
  const flags = unusual.slice(0, 3);

  const bands = [
    { id: 'high', label: 'High ≥95%', value: anpr.high, color: '#22c55e' },
    { id: 'med', label: 'Med 85–95%', value: anpr.medium, color: '#2f7dff' },
    { id: 'low', label: 'Low <85%', value: anpr.low, color: '#f59e0b' },
    { id: 'fail', label: 'Unreadable', value: anpr.unreadable, color: '#ef4444' },
  ];

  return (
    <Panel
      title="Camera / Activity Insights"
      action={
        <span className="tnum text-3xs text-accent-cyan">
          peak {peakUnit === 'hour' ? `${peakLabel}:00` : peakLabel} · {formatIn(peakValue)} vehicles
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-2.5 px-3 pb-2.5 pt-1"
    >
      {/* ANPR read quality */}
      <div>
        <SectionLabel note={`${formatIn(anpr.processed)} plates`}>ANPR read quality</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          <AnprStat
            label="OCR confidence"
            value={`${anpr.confidence.toFixed(1)}%`}
            sub={`avg ${anpr.latencyMs} ms`}
            tone="text-[#67e8f9]"
          />
          <AnprStat label="Successful reads" value={formatIn(anpr.successful)} sub={`${formatPct(successPct)} hit rate`} tone="text-[#6fe0b0]" />
          <AnprStat
            label="Unreadable"
            value={formatIn(anpr.unreadable)}
            sub={anpr.processed > 0 ? `${formatPct((anpr.unreadable / anpr.processed) * 100)} of ingest` : '0% of ingest'}
            tone="text-[#ff8b96]"
          />
        </div>
        <div className="mt-1.5 flex h-[6px] overflow-hidden rounded-full bg-[#0d1626] ring-1 ring-inset ring-edge-soft">
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
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-[2px]">
          {bands.map((band) => (
            <span key={band.id} className="flex items-center gap-1 text-[10px] text-[#9fb0cc]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: band.color }} />
              {band.label}
              <span className="tnum font-semibold text-white">{formatIn(band.value)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Most active cameras */}
      <div className="min-h-0">
        <SectionLabel note={`${top.length} of ${cameras.length} · by detections`}>Most active cameras</SectionLabel>
        {top.length === 0 ? (
          <div className="py-1 text-[12px] text-ink-dim">No cameras in this filter.</div>
        ) : (
          <ul className="flex flex-col gap-px">
            {top.map((camera, index) => (
              <li
                key={camera.id}
                className="group flex items-center gap-2 rounded-[5px] border border-transparent px-1.5 py-[4px] transition-colors hover:border-edge hover:bg-panel-hover"
              >
                <span className="tnum w-[13px] shrink-0 text-right text-[11px] font-bold text-[#6d82a3]">{index + 1}</span>
                <button
                  type="button"
                  title={`Filter to ${camera.code}`}
                  onClick={() => onSelectCamera(camera.code)}
                  className="tnum w-[44px] shrink-0 text-left text-[12px] font-bold text-[#9fc7ff] transition-colors hover:text-white"
                >
                  {camera.code}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[camera.status]}`} />
                    <span className="truncate text-[11.5px] font-semibold text-[#dbe6f5]">{camera.location}</span>
                    <span className="truncate text-[10px] text-[#6d7f9e]">· {camera.city}</span>
                  </span>
                  <span className="mt-[3px] block h-[3.5px] overflow-hidden rounded-full bg-[#14243c]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan transition-all duration-500"
                      style={{ width: `${(camera.detections / max) * 100}%` }}
                    />
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-none">
                  <span className="tnum text-[12.5px] font-bold text-white">{formatIn(camera.detections)}</span>
                  <span className="tnum text-[9.5px] text-[#6d82a3]">{camera.events} AI</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Unusual activity flags */}
      <div className="min-h-0 flex-1">
        <SectionLabel note={`${unusual.length} this window`}>Unusual activity</SectionLabel>
        {flags.length === 0 ? (
          <div className="py-1 text-[12px] text-ink-dim">No unusual indicators in the current filter.</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {flags.map((event) => (
              <li key={event.id} className="flex min-w-0 items-start gap-2 rounded-[5px] border border-transparent px-1 py-[3px] transition-colors hover:border-edge hover:bg-panel-hover">
                <span className="tnum w-[32px] shrink-0 pt-[1px] text-[11px] font-semibold text-[#8ea1c0]">{event.time}</span>
                <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${unusualDot[event.tone]}`} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] leading-[14px] text-[#c3cfe2]" title={event.text}>
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
