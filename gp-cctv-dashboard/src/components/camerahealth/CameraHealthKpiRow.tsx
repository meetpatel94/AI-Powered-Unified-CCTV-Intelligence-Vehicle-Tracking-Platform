import { Activity, AlertOctagon, Signal, WifiOff } from 'lucide-react';

import { fleetHealth, statusSlices } from '@/data/cameraHealthData';

import type { FleetHealth, StatusSlice } from '@/types/cameraHealth';

interface KpiCardDef {
  id: StatusSlice['id'] | 'total';
  label: string;
  value: number;
  percent?: number;
  hint: string;
  color: string;
  icon: typeof Activity;
  filter: 'all' | 'online' | 'offline' | 'poor' | 'reconnecting';
}

/** Five-card KPI strip. Clicking a card applies the matching status filter. */
export function CameraHealthKpiRow({
  active,
  monitored,
  attention,
  onSelect,
}: {
  active: string;
  monitored: number;
  attention: number;
  onSelect: (filter: KpiCardDef['filter']) => void;
}) {
  const fleet: FleetHealth = fleetHealth;
  const slices = statusSlices(fleet);
  const byId = new Map(slices.map((slice) => [slice.id, slice]));

  const cards: KpiCardDef[] = [
    {
      id: 'total',
      label: 'Total Cameras',
      value: fleet.total,
      hint: `${monitored} under live stream monitoring · avg ${fleet.avgFps} fps · ${fleet.ingestMbps} Mb/s ingest`,
      color: '#22d3ee',
      icon: Activity,
      filter: 'all',
    },
    {
      id: 'online',
      label: 'Online',
      value: fleet.online,
      percent: byId.get('online')?.whole ?? 87,
      hint: 'RTSP session up · heartbeats nominal',
      color: '#22c55e',
      icon: Signal,
      filter: 'online',
    },
    {
      id: 'offline',
      label: 'Offline',
      value: fleet.offline,
      percent: byId.get('offline')?.whole ?? 9,
      hint: 'No frames · RTSP handshake failing',
      color: '#ef4444',
      icon: WifiOff,
      filter: 'offline',
    },
    {
      id: 'poor',
      label: 'Poor Signal',
      value: fleet.poor,
      percent: byId.get('poor')?.whole ?? 4,
      hint: 'Degraded fps / latency / packet loss',
      color: '#f59e0b',
      icon: Signal,
      filter: 'poor',
    },
    {
      id: 'critical',
      label: 'Critical / Needs Attention',
      value: attention,
      hint: 'Feeds past critical threshold or requiring operator action',
      color: '#ff5c72',
      icon: AlertOctagon,
      filter: 'all',
    },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.id === 'offline' ? WifiOff : card.icon;
        const selected = active === card.filter;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelect(card.filter)}
            title={card.hint}
            className={`group panel relative min-h-[104px] overflow-hidden px-3.5 py-3 text-left transition-colors ${
              selected ? 'border-edge-strong bg-panel-hover' : 'hover:bg-panel-hover/60'
            }`}
          >
            <span
              className="absolute inset-x-0 top-0 h-[2px] opacity-70"
              style={{ background: `linear-gradient(90deg, ${card.color}, transparent 85%)` }}
            />
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.11em] text-ink-dim">{card.label}</span>
              <span
                className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[4px] border"
                style={{ borderColor: `${card.color}44`, backgroundColor: `${card.color}14`, color: card.color }}
              >
                <Icon size={13} strokeWidth={2.2} />
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum kpi-value font-bold text-white">{card.value.toLocaleString('en-IN')}</span>
              {typeof card.percent === 'number' ? (
                <span className="tnum rounded-[3px] px-1.5 py-[2px] text-[12px] font-semibold" style={{ color: card.color, backgroundColor: `${card.color}18` }}>
                  {card.percent}%
                </span>
              ) : null}
            </div>

            <p className="mt-2 truncate text-[13px] text-ink-faint">{card.hint}</p>

            {/* share-of-fleet bar */}
            <span className="mt-2.5 block h-[4px] overflow-hidden rounded-full bg-[#111c30]">
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{
                  width: card.id === 'total' ? '100%' : card.id === 'critical' ? `${Math.min(100, (card.value / Math.max(1, fleet.total)) * 100)}%` : `${((byId.get(card.id)?.count ?? card.value) / fleet.total) * 100}%`,
                  backgroundColor: card.color,
                  boxShadow: `0 0 8px -1px ${card.color}`,
                }}
              />
            </span>

            {card.id === 'critical' && attention > 0 ? (
              <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1 text-3xs font-semibold text-[#ff8b96]">
                <AlertOctagon size={11} strokeWidth={2.4} />
                {attention} flagged
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
