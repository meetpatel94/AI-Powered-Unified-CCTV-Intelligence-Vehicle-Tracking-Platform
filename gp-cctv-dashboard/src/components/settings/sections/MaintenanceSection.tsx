import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, Power, ShieldAlert, Wrench } from 'lucide-react';

import {
  MAINTENANCE_ACTIONS,
  MAINTENANCE_RESULTS,
  SECTION_META,
} from '@/data/settingsData';

import { ConfirmModal } from '@/components/settings/ConfirmModal';
import {
  InfoNote,
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSelect,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { MaintenanceActionDef, MaintenanceActionId, MaintenanceConfig, SettingValue } from '@/types/settings';

interface MaintenanceSectionProps {
  cfg: MaintenanceConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
  /** Page-level ledger + toast for completed maintenance runs. */
  onRunComplete: (action: MaintenanceActionDef, result: string) => void;
}

const p = 'maintenance';

const toneStyles: Record<MaintenanceActionDef['tone'], { iconCls: string; border: string; btnCls: string }> = {
  primary: {
    iconCls: 'text-accent-cyan',
    border: 'hover:border-accent-cyan/50',
    btnCls: 'border-accent-cyan/40 bg-accent-cyan/10 text-[#a5f3fc] hover:bg-accent-cyan/20',
  },
  warn: {
    iconCls: 'text-[#fbbf24]',
    border: 'hover:border-[#f59e0b]/50',
    btnCls: 'border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#fde2a6] hover:bg-[#f59e0b]/20',
  },
  danger: {
    iconCls: 'text-[#f87171]',
    border: 'hover:border-accent-red/50',
    btnCls: 'border-accent-red/40 bg-accent-red/10 text-[#ffb4bc] hover:bg-accent-red/20',
  },
  neutral: {
    iconCls: 'text-ink-dim',
    border: 'hover:border-edge-strong',
    btnCls: 'border-edge bg-[#0c1424] text-ink-dim hover:text-ink',
  },
};

const toneChip: Record<MaintenanceActionDef['tone'], 'cyan' | 'amber' | 'red' | 'slate'> = {
  primary: 'cyan',
  warn: 'amber',
  danger: 'red',
  neutral: 'slate',
};

/** Backup, cache, index, restart and camera-test controls. Destructive
 *  actions always confirm first. */
export function MaintenanceSection({ cfg, patch, pending, onRunComplete }: MaintenanceSectionProps) {
  const meta = SECTION_META.maintenance;
  const [confirmAction, setConfirmAction] = useState<MaintenanceActionDef | null>(null);
  const [runningId, setRunningId] = useState<MaintenanceActionId | null>(null);
  const timers = useRef<Array<number>>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const launch = (action: MaintenanceActionDef) => {
    setRunningId(action.id);
    setConfirmAction(null);
    const durationMs = action.id === 'backup' ? 2400 : action.id === 'rebuild-index' ? 2600 : action.id === 'test-cameras' ? 2100 : 1600;
    const timer = window.setTimeout(() => {
      setRunningId(null);
      const result = MAINTENANCE_RESULTS[action.id];
      onRunComplete(action, result);
    }, durationMs);
    timers.current.push(timer);
  };

  const running = MAINTENANCE_ACTIONS.find((action) => action.id === runningId) ?? null;

  return (
    <SectionPanel
      id="section-maintenance"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone={cfg.maintenanceMode ? 'amber' : 'green'} pulse>{cfg.maintenanceMode ? 'MAINTENANCE MODE ON' : 'ops normal'}</StateChip>}
    >
      {/* Maintenance mode banner */}
      <div
        className={`mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3.5 py-3 ${
          cfg.maintenanceMode ? 'border-[#f59e0b]/45 bg-[#231a08]' : 'border-edge bg-[#0c1424]'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border ${
              cfg.maintenanceMode ? 'border-[#f59e0b]/50 bg-[#f59e0b]/15 text-[#fbbf24]' : 'border-edge bg-[#101a2e] text-ink-dim'
            }`}
          >
            <Power size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#e6edf7]">
              Maintenance Mode
              {cfg.maintenanceMode ? <StateChip tone="amber" pulse>ACTIVE</StateChip> : <StateChip tone="green">off</StateChip>}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-[14px] text-ink-dim">
              {cfg.maintenanceMode
                ? 'Scheduled jobs paused · operator edits queued · console is read-only until disabled.'
                : 'Pause scheduled jobs and freeze configuration during supervised maintenance windows.'}
            </p>
          </div>
        </div>
        <SettingToggle
          checked={cfg.maintenanceMode}
          onChange={(next) => patch(`${p}.maintenanceMode`, next)}
          label="Maintenance mode"
          caption
        />
      </div>

      {cfg.maintenanceMode ? (
        <div className="pt-2">
          <InfoNote tone="amber" icon={ShieldAlert}>
            MAINTENANCE WINDOW — auto-restart policy is suspended and a completion notification will be sent to the duty engineer
            when mode is disabled.
          </InfoNote>
        </div>
      ) : null}

      <SectionSubhead right="scheduled behaviour">
        <span className="flex items-center gap-1.5">
          <Wrench size={11} />
          Maintenance policy
        </span>
      </SectionSubhead>

      <SettingRow label="Maintenance window" hint="Preferred quiet-hours slot for automatically scheduled upkeep.">
        <SettingSelect
          ariaLabel="Maintenance window"
          value={cfg.maintenanceWindow}
          onChange={(next) => patch(`${p}.maintenanceWindow`, next)}
          options={[
            { value: '02:00–03:00 IST', label: '02:00–03:00 IST nightly' },
            { value: '03:00–04:00 IST', label: '03:00–04:00 IST nightly' },
            { value: 'Sunday 03:00 IST', label: 'Sunday 03:00–05:00 IST' },
            { value: 'manual-only', label: 'Manual only' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Auto-restart policy" hint="When the platform may self-restart a degraded subsystem.">
        <SettingSelect
          ariaLabel="Auto-restart policy"
          value={cfg.autoRestartPolicy}
          onChange={(next) => patch(`${p}.autoRestartPolicy`, next)}
          options={[
            { value: 'never', label: 'Never — always page an engineer' },
            { value: 'critical-failure', label: 'On critical failure only' },
            { value: 'nightly', label: 'Nightly 04:00 IST' },
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Completion notifications"
        hint="Toast + email the duty engineer when scheduled maintenance finishes."
      >
        <SettingToggle
          checked={cfg.notifyOnCompletion}
          onChange={(next) => patch(`${p}.notifyOnCompletion`, next)}
          label="Completion notifications"
          caption
        />
      </SettingRow>

      <SectionSubhead right="destructive actions require confirmation">
        <span className="flex items-center gap-1.5">
          <Power size={11} />
          Manual operations
        </span>
      </SectionSubhead>

      <div className="grid grid-cols-1 gap-2 py-2 md:grid-cols-2 2xl:grid-cols-3">
        {MAINTENANCE_ACTIONS.map((action) => {
          const styles = toneStyles[action.tone];
          const isRunning = runningId === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => setConfirmAction(action)}
              disabled={runningId !== null}
              className={`group relative flex flex-col overflow-hidden rounded-[7px] border border-edge bg-[#0c1424] p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70 ${styles.border}`}
            >
              {isRunning ? <span className="btn-sheen pointer-events-none absolute inset-0 overflow-hidden" /> : null}
              <span className="flex items-center justify-between gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-[6px] border ${action.tone === 'primary' ? 'border-accent-cyan/40 bg-accent-cyan/10' : action.tone === 'warn' ? 'border-[#f59e0b]/40 bg-[#f59e0b]/10' : action.tone === 'danger' ? 'border-accent-red/40 bg-accent-red/10' : 'border-edge bg-[#101a2e]'}`}>
                  {isRunning ? (
                    <LoaderCircle size={15} className="animate-spin text-accent-cyan" />
                  ) : (
                    <action.icon size={15} strokeWidth={2} className={styles.iconCls} />
                  )}
                </span>
                <StateChip tone={toneChip[action.tone]}>{action.destructive ? 'confirm required' : 'safe'}</StateChip>
              </span>
              <span className="mt-2 block text-[13px] font-semibold text-[#dbe5f4]">{action.label}</span>
              <span className="mt-0.5 block text-[10.5px] leading-[13px] text-ink-faint">{action.description}</span>
              <span className="mt-2 flex items-center justify-between border-t border-edge/50 pt-1.5 text-[10px] text-ink-faint">
                <span className="flex items-center gap-1">
                  {isRunning ? (
                    <>
                      <LoaderCircle size={9} className="animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={9} className="text-[#6fe0b0]" /> Last · {action.lastRun}
                    </>
                  )}
                </span>
                <span className="tnum font-medium text-[#5c6b87]">{action.durationHint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirmation for destructive / supervised operations */}
      <ConfirmModal
        open={confirmAction !== null}
        tone={confirmAction?.destructive ? (confirmAction.id === 'restart-gateway' ? 'danger' : 'warning') : 'primary'}
        icon={confirmAction?.destructive ? 'alert' : 'none'}
        title={confirmAction ? `${confirmAction.destructive ? 'Confirm' : 'Run'} — ${confirmAction.label}` : ''}
        message={
          confirmAction
            ? confirmAction.id === 'restart-gateway'
              ? 'Restarting the Stream Gateway drops every live RTSP / WebRTC / HLS session for about 2 minutes. Operators will see feeds reconnect automatically.'
              : confirmAction.id === 'clear-cache'
                ? 'Purge the thumbnail, tile and segment caches? Live traffic keeps flowing — cache rebuilds itself lazily.'
                : confirmAction.id === 'rebuild-index'
                  ? 'Rebuild the full-text and ANPR lookup indexes from metadata? Searches stay available but slower while the ~8 minute rebuild runs.'
                  : confirmAction.id === 'restart-ai'
                    ? 'Reload detection models and OCR pipelines on all inference nodes? Detection pauses for roughly 90 seconds per node.'
                    : confirmAction.id === 'backup'
                      ? 'Create a full encrypted backup snapshot of evidence, metadata and watchlist state?'
                      : 'Run a connectivity sweep across all registered backend camera feeds?'
            : ''
        }
        detail={
          confirmAction
            ? `${confirmAction.description} · ETA ${confirmAction.durationHint} · action is recorded in the audit ledger.`
            : undefined
        }
        confirmLabel={running ? 'Running…' : confirmAction?.destructive ? 'Confirm & run' : 'Run now'}
        busy={running !== null}
        busyLabel={`${running?.label ?? 'Running'}…`}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) launch(confirmAction);
        }}
      />

      {running ? (
        <div className="flex items-center gap-2 pt-2 text-[11.5px] text-ink-dim">
          <LoaderCircle size={12} className="animate-spin text-accent-cyan" />
          <span>
            <span className="font-semibold text-[#a5f3fc]">{running.label}</span> in progress — subsystems will reconverge shortly
            (simulated).
          </span>
        </div>
      ) : null}
    </SectionPanel>
  );
}
