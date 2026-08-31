import { AlertTriangle, Camera, CircleSlash, SignalHigh, TriangleAlert } from 'lucide-react';

import { fleetStats, legendItems } from '@/data/cameraMapData';

/** Compact fleet counters that sit above the map canvas. */
export function MapStatsStrip() {
  const items = [
    {
      id: 'total',
      label: 'Total Cameras',
      value: fleetStats.total,
      sub: 'statewide',
      color: '#7db4ff',
      icon: Camera,
    },
    {
      id: 'online',
      label: 'Online',
      value: fleetStats.online.value,
      sub: fleetStats.online.pct,
      color: '#22c55e',
      icon: SignalHigh,
    },
    {
      id: 'offline',
      label: 'Offline',
      value: fleetStats.offline.value,
      sub: fleetStats.offline.pct,
      color: '#ef4444',
      icon: CircleSlash,
    },
    {
      id: 'warning',
      label: 'Warning / Poor Signal',
      value: fleetStats.warning.value,
      sub: fleetStats.warning.pct,
      color: '#f59e0b',
      icon: TriangleAlert,
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: String(fleetStats.activeAlerts),
      sub: 'live',
      color: '#f87171',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex shrink-0 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex flex-1 items-center gap-2 rounded-md border border-edge bg-panel px-2.5 py-[7px]"
          >
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[5px]"
              style={{ background: `${item.color}1f`, color: item.color }}
            >
              <Icon size={13} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[9px] uppercase tracking-wide text-ink-dim">{item.label}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-[15px] font-bold leading-none text-white">{item.value}</span>
                <span className="tnum text-[9px]" style={{ color: item.color }}>
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-[5px] border border-edge bg-[#0a1220]/92 px-2.5 py-1.5 backdrop-blur-sm">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-dim">Legend</span>
      {legendItems.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[9px] text-[#a9bcd8]">
          {item.kind === 'dot' && (
            <span
              className="h-[9px] w-[9px] rounded-full ring-1 ring-black/50"
              style={{ background: item.color, boxShadow: `0 0 7px ${item.color}90` }}
            />
          )}
          {item.kind === 'cluster' && (
            <span
              className="tnum grid h-[13px] w-[13px] place-items-center rounded-full border border-white/70 text-[7px] font-bold text-white"
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
