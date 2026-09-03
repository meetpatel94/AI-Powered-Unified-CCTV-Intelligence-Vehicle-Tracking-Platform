import { AlertTriangle, Camera, CircleSlash, SignalHigh, TriangleAlert } from 'lucide-react';

import { fleetStats, legendItems } from '@/data/cameraMapData';

export interface MapFleetStats {
  total: string;
  online: { value: string; pct: string };
  offline: { value: string; pct: string };
  warning: { value: string; pct: string };
  activeAlerts: number;
}

/** Compact fleet counters that sit above the map canvas. */
export function MapStatsStrip({ stats = fleetStats }: { stats?: MapFleetStats }) {
  const items = [
    {
      id: 'total',
      label: 'Total Cameras',
      value: stats.total,
      sub: 'statewide',
      color: '#7db4ff',
      icon: Camera,
    },
    {
      id: 'online',
      label: 'Online',
      value: stats.online.value,
      sub: stats.online.pct,
      color: '#22c55e',
      icon: SignalHigh,
    },
    {
      id: 'offline',
      label: 'Offline',
      value: stats.offline.value,
      sub: stats.offline.pct,
      color: '#ef4444',
      icon: CircleSlash,
    },
    {
      id: 'warning',
      label: 'Warning / Poor Signal',
      value: stats.warning.value,
      sub: stats.warning.pct,
      color: '#f59e0b',
      icon: TriangleAlert,
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: String(stats.activeAlerts),
      sub: 'live',
      color: '#f87171',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex shrink-0 gap-2.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-edge bg-panel px-3 py-2"
          >
            <span
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[5px]"
              style={{ background: `${item.color}1f`, color: item.color }}
            >
              <Icon size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] uppercase tracking-wide text-ink-dim">{item.label}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-[18px] font-bold leading-none text-white">{item.value}</span>
                <span className="tnum text-[13px]" style={{ color: item.color }}>
                  {item.sub}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Legend pinned to the bottom edge of the canvas. */
export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3.5 rounded-[5px] border border-edge bg-[#0a1220]/92 px-3 py-2 backdrop-blur-sm">
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-ink-dim">Legend</span>
      {legendItems.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[13px] text-[#a9bcd8]">
          {item.kind === 'dot' && (
            <span
              className="h-[10px] w-[10px] rounded-full ring-1 ring-black/50"
              style={{ background: item.color, boxShadow: `0 0 7px ${item.color}90` }}
            />
          )}
          {item.kind === 'cluster' && (
            <span
              className="tnum grid h-[15px] w-[15px] place-items-center rounded-full border border-white/70 text-[10.5px] font-bold text-white"
              style={{ background: item.color }}
            >
              8
            </span>
          )}
          {item.kind === 'line' && (
            <span className="flex items-center">
              <span className="h-[2px] w-4 rounded-full" style={{ background: item.color }} />
              <span className="h-[2px] w-2 rounded-full bg-accent-red" />
            </span>
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}
