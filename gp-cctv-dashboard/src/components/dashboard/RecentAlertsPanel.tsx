import { Panel, ViewAll } from '@/components/common/Panel';
import type { AlertItem, Severity } from '@/types';

const severityStyles: Record<
  Severity,
  { shell: string; icon: string; iconBg: string; title: string }
> = {
  critical: {
    shell: 'border-l-accent-red border-y-[#4a1620] border-r-[#4a1620] bg-[#2a0d13]',
    icon: 'text-accent-red',
    iconBg: 'bg-accent-red/15 ring-accent-red/40',
    title: 'text-[#ff8b96]',
  },
  high: {
    shell: 'border-l-accent-orange border-y-[#4a3512] border-r-[#4a3512] bg-[#2a1e0a]',
    icon: 'text-accent-orange',
    iconBg: 'bg-accent-orange/15 ring-accent-orange/40',
    title: 'text-[#f7b95f]',
  },
  medium: {
    shell: 'border-l-accent-yellow border-y-[#4a4212] border-r-[#4a4212] bg-[#26220a]',
    icon: 'text-accent-yellow',
    iconBg: 'bg-accent-yellow/15 ring-accent-yellow/40',
    title: 'text-[#eddb6a]',
  },
  info: {
    shell: 'border-l-accent-blue border-y-[#16305a] border-r-[#16305a] bg-[#0c1c36]',
    icon: 'text-[#5aa2ff]',
    iconBg: 'bg-accent-blue/15 ring-accent-blue/40',
    title: 'text-[#7db4ff]',
  },
};

function AlertRow({ alert }: { alert: AlertItem }) {
  const tone = severityStyles[alert.severity];
  const Icon = alert.icon;

  return (
    <button
      type="button"
      className={`flex w-full items-start gap-2 rounded-[5px] border border-l-[3px] px-2 py-[7px] text-left transition-colors hover:brightness-125 ${tone.shell}`}
    >
      <span className={`mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ring-1 ${tone.iconBg}`}>
        <Icon size={12} strokeWidth={2.1} className={tone.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`truncate text-[12.5px] font-semibold ${tone.title}`}>{alert.type}</span>
          <span className="tnum shrink-0 text-3xs text-ink-dim">{alert.time}</span>
        </span>
        {alert.plate ? (
          <span className="mt-[1px] block truncate text-[13px] font-semibold tracking-wide text-white">
            {alert.plate}
          </span>
        ) : null}
        <span className="mt-[1px] flex items-end justify-between gap-2">
          <span className="truncate text-[11.5px] text-[#94a5c2]">
            {alert.cameraCode} | {alert.location}
          </span>
          <span className="shrink-0 text-3xs text-[#6d7f9e]">{alert.ago}</span>
        </span>
      </span>
    </button>
  );
}

export function RecentAlertsPanel({ alerts = [] }: { alerts?: AlertItem[] }) {
  return (
    <Panel
      title="Recent Alerts"
      action={<ViewAll />}
      className="h-full min-h-0"
      bodyClassName="flex flex-col justify-between gap-1.5 overflow-y-auto px-2 pb-2 pt-0.5"
    >
      {alerts.length ? (
        alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
      ) : (
        <div className="grid min-h-[220px] place-items-center rounded-[5px] border border-dashed border-edge bg-[#071120] px-4 text-center">
          <div>
            <div className="text-[13px] font-semibold text-white">No alerts</div>
            <div className="mt-1 text-[11.5px] text-ink-dim">The backend has not reported any active or recent alerts.</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
