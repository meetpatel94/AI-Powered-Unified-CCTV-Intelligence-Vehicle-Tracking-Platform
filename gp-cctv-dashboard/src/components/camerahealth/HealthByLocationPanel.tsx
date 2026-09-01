import { MapPin } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { toneInk } from '@/components/camerahealth/healthTones';

import type { LocationHealthRow, MetricTone } from '@/types/cameraHealth';

const toneFor = (score: number): MetricTone => (score < 55 ? 'red' : score < 78 ? 'amber' : score < 95 ? 'cyan' : 'green');

/**
 * HEALTH BY LOCATION — every monitored area ranked worst-first, with the mean
 * health score, fleet split and the weakest camera in that area.
 */
export function HealthByLocationPanel({ rows, onDrill }: { rows: LocationHealthRow[]; onDrill: (area: string) => void }) {
  return (
    <Panel
      title="Health By Location"
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col"
      tools={<span className="font-mono text-[9px] text-ink-faint">ranked worst first</span>}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        <ul className="space-y-[3px]">
          {rows.map((row, index) => {
            const tone = toneFor(row.score);
            const color = toneInk[tone];
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onDrill(row.label)}
                  title={`Search the monitor grid for ${row.label} · worst feed ${row.worst}`}
                  className="group flex w-full items-center gap-2 rounded-[4px] border border-transparent px-1.5 py-[3px] text-left transition-colors hover:border-edge hover:bg-panel-hover/60"
                >
                  <span className="tnum w-[14px] shrink-0 text-right font-mono text-[9px] text-ink-faint">{index + 1}</span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <MapPin size={9} className="shrink-0 text-ink-faint" />
                      <span className="truncate text-[10px] text-[#d7e1f1]">{row.label}</span>
                      <span className="truncate text-[8.5px] text-ink-faint">{row.city}</span>
                    </span>
                    <span className="mt-[2px] flex items-center gap-1.5">
                      <span className="relative h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-[#111c30]">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                          style={{ width: `${row.score}%`, backgroundColor: color, boxShadow: `0 0 6px -1px ${color}` }}
                        />
                      </span>
                      <span className="tnum font-mono text-[8.5px] text-ink-faint">
                        <span style={{ color }}>{row.online}</span> ok ·{' '}
                        <span className={row.degraded ? 'text-[#f7b95f]' : ''}>{row.degraded}</span> deg ·{' '}
                        <span className={row.down ? 'text-[#ff8b96]' : ''}>{row.down}</span> down
                      </span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="tnum block font-mono text-[11px] font-bold" style={{ color }}>
                      {row.score}
                    </span>
                    <span className="tnum block font-mono text-[8px] text-ink-faint">{row.cameras} cams</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
