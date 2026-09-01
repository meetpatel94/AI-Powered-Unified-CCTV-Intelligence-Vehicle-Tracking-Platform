interface ChartTipRow {
  label: string;
  value: string;
  color?: string;
}

interface ChartTipProps {
  visible: boolean;
  /** Pixel position inside the relatively-positioned plot. */
  x: number;
  y: number;
  title: string;
  rows: ChartTipRow[];
}

/** Floating telemetry tooltip used by every analytics chart. */
export function ChartTip({ visible, x, y, title, rows }: ChartTipProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[128px] rounded-[5px] border border-edge-strong bg-[#0a162c]/95 px-2 py-1.5 shadow-panel backdrop-blur-sm"
      style={{ left: x, top: y, transform: 'translate(-50%, calc(-100% - 10px))' }}
    >
      <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]">{title}</div>
      <ul className="mt-1 space-y-[2px]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1 text-[9.5px] text-[#9fb0cc]">
              {row.color ? (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
              ) : null}
              {row.label}
            </span>
            <span className="tnum text-[10px] font-bold text-white">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
