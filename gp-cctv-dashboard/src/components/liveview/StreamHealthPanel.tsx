import { Panel } from '@/components/common/Panel';
import { streamHealthMetrics, streamStates } from '@/data/liveViewData';
import { drift } from '@/hooks/useTelemetryTick';

const toneBar: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
};

const toneText: Record<string, string> = {
  green: 'text-accent-green',
  amber: 'text-accent-orange',
  red: 'text-accent-red',
  blue: 'text-[#7db4ff]',
};

/**
 * Fleet-level ingest telemetry strip that sits under the camera wall:
 * state counters on the left, live quality metrics on the right.
 */
export function StreamHealthPanel({ tick }: { tick: number }) {
  return (
    <Panel
      title="Stream Health"
      tools={
        <span className="flex items-center gap-2 text-3xs text-ink-dim">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
            gateway connected
          </span>
          <span>last 5 min</span>
        </span>
      }
      className="shrink-0"
      bodyClassName="flex items-stretch gap-2.5 px-2.5 pb-2.5 pt-1"
    >
      {/* state counters */}
      <div className="flex shrink-0 gap-1.5">
        {streamStates.map((state) => (
          <div
            key={state.id}
            className="flex w-[74px] flex-col items-center justify-center rounded-[4px] border border-edge-soft bg-[#0c1424] py-[6px]"
          >
            <span className="tnum text-[15px] font-bold leading-none" style={{ color: state.color }}>
              {state.count}
            </span>
            <span className="mt-[3px] text-[7.5px] uppercase tracking-wide text-[#7286a6]">
              {state.label}
            </span>
          </div>
        ))}
      </div>

      <div className="w-px shrink-0 bg-edge-soft" />

      {/* metric bars */}
      <ul className="grid min-w-0 flex-1 grid-cols-4 gap-x-3 gap-y-1">
        {streamHealthMetrics.map((metric) => {
          const live =
            metric.id === 'fps'
              ? `${drift(24.6, 0.4, 'fleet-fps', tick, 1)}`
              : metric.id === 'latency'
                ? `${drift(186, 12, 'fleet-lat', tick)} ms`
                : metric.id === 'bitrate'
                  ? `${drift(48.9, 1.4, 'fleet-br', tick, 1)} Mb/s`
                  : metric.value;

          return (
            <li key={metric.id} className="flex flex-col justify-center">
              <div className="mb-[3px] flex items-baseline justify-between gap-2">
                <span className="truncate text-[9px] uppercase tracking-wide text-[#7286a6]">
                  {metric.label}
                </span>
                <span className={`tnum text-[10.5px] font-semibold ${toneText[metric.tone]}`}>{live}</span>
              </div>
              <div className="h-[4px] w-full overflow-hidden rounded-full bg-[#101c30]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${metric.pct}%`,
                    background: toneBar[metric.tone],
                    boxShadow: `0 0 8px ${toneBar[metric.tone]}66`,
                  }}
                />
              </div>
              <div className="mt-[2px] text-[8px] text-[#5f7fa8]">{metric.sub}</div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
