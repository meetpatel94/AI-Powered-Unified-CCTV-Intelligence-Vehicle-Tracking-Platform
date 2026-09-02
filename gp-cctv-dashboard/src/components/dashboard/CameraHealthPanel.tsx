import { Panel, ViewAll } from '@/components/common/Panel';
import { cameraHealth } from '@/data/mockData';

const SIZE = 98;
const STROKE = 15;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/** Donut chart + legend of the fleet's operational state. */
export function CameraHealthPanel() {
  let offset = 0;

  return (
    <Panel
      title="Camera Health"
      action={<ViewAll />}
      className="shrink-0"
      bodyClassName="flex items-center gap-3 px-3 pb-3 pt-1"
    >
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#111c30"
            strokeWidth={STROKE}
          />
          {cameraHealth.map((slice) => {
            const len = (slice.percent / 100) * CIRC;
            const dash = `${len} ${CIRC - len}`;
            const el = (
              <circle
                key={slice.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ filter: `drop-shadow(0 0 5px ${slice.color}55)` }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
      </div>

      <ul className="min-w-0 flex-1 space-y-[9px]">
        {cameraHealth.map((slice) => (
          <li key={slice.id} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: slice.color, boxShadow: `0 0 6px ${slice.color}70` }}
            />
            <span className="flex-1 truncate text-[#c3cfe2]">{slice.label}</span>
            <span className="tnum shrink-0 text-[#8fa0bd]">
              {slice.count.toLocaleString('en-IN')} ({slice.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
