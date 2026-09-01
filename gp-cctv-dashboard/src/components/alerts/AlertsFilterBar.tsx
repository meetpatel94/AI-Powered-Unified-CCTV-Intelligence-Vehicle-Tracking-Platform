import { Search, XCircle } from 'lucide-react';

import { alertTypeGroups } from '@/data/alertsData';
import { alertCameraOptions } from '@/data/alertsData';

export type AlertScopeId = 'all' | 'unreviewed' | 'critical' | 'progress' | 'resolved';
export type AlertStatusFilter = 'all' | 'new' | 'acknowledged' | 'investigating' | 'escalated' | 'progress' | 'resolved';
export type AlertWindow = '30m' | '1h' | '4h' | '12h' | 'day';

interface AlertsFilterBarProps {
  scope: AlertScopeId;
  onScope: (scope: AlertScopeId) => void;
  scopeCounts: Record<AlertScopeId, number>;
  severity: string;
  onSeverity: (value: string) => void;
  group: string;
  onGroup: (value: string) => void;
  camera: string;
  onCamera: (value: string) => void;
  window: AlertWindow;
  onWindow: (value: AlertWindow) => void;
  status: AlertStatusFilter;
  onStatus: (value: AlertStatusFilter) => void;
  query: string;
  onQuery: (value: string) => void;
  onReset: () => void;
  dirty: boolean;
}

const selectCls =
  'h-[28px] shrink-0 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[10.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

const scopePills: Array<{ id: AlertScopeId; label: string; tone: string }> = [
  { id: 'all', label: 'All Alerts', tone: 'data' },
  { id: 'unreviewed', label: 'Unreviewed', tone: 'blue' },
  { id: 'critical', label: 'Critical', tone: 'red' },
  { id: 'progress', label: 'In Progress', tone: 'purple' },
  { id: 'resolved', label: 'Resolved', tone: 'green' },
];

/** Quick scopes + severity / type / camera / date-time / status selects + search. */
export function AlertsFilterBar({
  scope,
  onScope,
  scopeCounts,
  severity,
  onSeverity,
  group,
  onGroup,
  camera,
  onCamera,
  window: windowId,
  onWindow,
  status,
  onStatus,
  query,
  onQuery,
  onReset,
  dirty,
}: AlertsFilterBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-md border border-edge bg-panel px-2 py-2">
      {/* quick scopes */}
      <div className="flex shrink-0 items-center gap-px overflow-hidden rounded-[5px] border border-edge bg-[#0a1120] p-px">
        {scopePills.map((pill) => {
          const active = scope === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onScope(pill.id)}
              className={`tnum flex h-[26px] items-center gap-1 rounded-[4px] px-2 text-[9.5px] font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.9)]'
                  : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
              }`}
            >
              {pill.label}
              <span
                className={`rounded-[3px] px-1 text-[8.5px] font-bold leading-[13px] ${
                  active ? 'bg-white/20 text-white' : 'bg-[#16233a] text-[#9fb0cc]'
                }`}
              >
                {scopeCounts[pill.id]}
              </span>
            </button>
          );
        })}
      </div>

      <span className="h-[18px] w-px shrink-0 bg-edge" />

      <select value={severity} onChange={(e) => onSeverity(e.target.value)} className={`${selectCls} w-[104px]`}>
        <option value="all">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="info">Info / Low</option>
      </select>

      <select value={group} onChange={(e) => onGroup(e.target.value)} className={`${selectCls} w-[132px]`}>
        <option value="all">All Alert Types</option>
        {alertTypeGroups.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>

      <select value={camera} onChange={(e) => onCamera(e.target.value)} className={`${selectCls} w-[172px]`}>
        <option value="all">All Cameras / Locations</option>
        {alertCameraOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>

      <select value={windowId} onChange={(e) => onWindow(e.target.value as AlertWindow)} className={`${selectCls} w-[100px]`}>
        <option value="30m">Last 30 min</option>
        <option value="1h">Last 1 hour</option>
        <option value="4h">Last 4 hours</option>
        <option value="12h">Last 12 hours</option>
        <option value="day">Full day</option>
      </select>

      <select value={status} onChange={(e) => onStatus(e.target.value as AlertStatusFilter)} className={`${selectCls} w-[112px]`}>
        <option value="all">All Statuses</option>
        <option value="new">Unreviewed</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="investigating">Investigating</option>
        <option value="escalated">Escalated</option>
        <option value="progress">In Progress</option>
        <option value="resolved">Resolved</option>
      </select>

      <div className="relative min-w-[150px] flex-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search plate / camera / location…"
          className="h-[28px] w-full rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-7 text-[10.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6d7f9e] transition-colors hover:text-white"
          >
            <XCircle size={13} />
          </button>
        ) : null}
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={onReset}
          className="link-action flex h-[28px] shrink-0 items-center gap-1 rounded-[4px] border border-edge px-2 text-[10px] hover:border-accent-red/50 hover:text-[#ff8b96]"
        >
          <XCircle size={11} />
          Reset
        </button>
      ) : null}
    </div>
  );
}
