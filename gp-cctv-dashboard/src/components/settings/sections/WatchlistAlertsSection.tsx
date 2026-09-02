import { ArrowUpRight, RefreshCw, ShieldAlert } from 'lucide-react';

import {
  NUMERIC_META_OF,
  PRIORITY_OPTIONS,
  SECTION_META,
} from '@/data/settingsData';

import {
  InfoNote,
  SectionPanel,
  SectionSubhead,
  SettingChips,
  SettingRow,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { SettingValue, WatchlistAlertsConfig } from '@/types/settings';

interface WatchlistAlertsSectionProps {
  cfg: WatchlistAlertsConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'watchlist';

const priorityLabel = (value: string) => PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Real-time watchlist matching and alert-priority policy. */
export function WatchlistAlertsSection({ cfg, patch, pending }: WatchlistAlertsSectionProps) {
  const meta = SECTION_META.watchlist;
  return (
    <SectionPanel
      id="section-watchlist"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="amber"><ShieldAlert size={11} /> 1,248 watchlist entries</StateChip>}
    >
      <SectionSubhead right="matcher latency · ~190 ms end-to-end">
        <span className="flex items-center gap-1.5">
          <ShieldAlert size={11} />
          Real-time matching
        </span>
      </SectionSubhead>

      <SettingRow
        label="Real-time matching"
        hint="Compare every ANPR read against the active watchlist before it reaches the alert engine."
      >
        <SettingToggle
          checked={cfg.realtimeMatching}
          onChange={(next) => patch(`${p}.realtimeMatching`, next)}
          label="Real-time matching"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Critical alert threshold"
        hint="More than this many matches per minute on one camera escalates the event to CRITICAL."
      >
        <div className={cfg.realtimeMatching ? '' : 'pointer-events-none opacity-40'}>
          <SettingSlider
            ariaLabel="Critical alert threshold"
            value={cfg.criticalThresholdPerMin}
            meta={NUMERIC_META_OF(`${p}.criticalThresholdPerMin`)}
            onChange={(next) => patch(`${p}.criticalThresholdPerMin`, next)}
            readout={`${cfg.criticalThresholdPerMin} matches/min`}
          />
        </div>
      </SettingRow>

      <SettingRow label="Alert priority levels" hint="Severity bands the console dispatches. Critical is always on.">
        <SettingChips
          ariaLabel="Alert priority levels"
          value={cfg.priorityLevels}
          onChange={(next) => patch(`${p}.priorityLevels`, next)}
          options={PRIORITY_OPTIONS}
        />
      </SettingRow>

      <SettingRow
        label="Alert sound"
        hint="Audible tone at the control-room console when a new critical alert lands."
      >
        <SettingToggle checked={cfg.soundAlert} onChange={(next) => patch(`${p}.soundAlert`, next)} label="Alert sound" caption />
      </SettingRow>

      <SettingRow
        label="Automatic escalation"
        hint="Unacknowledged alerts rise one priority level after the chosen delay."
      >
        <SettingSelect
          ariaLabel="Automatic escalation"
          value={cfg.autoEscalation}
          onChange={(next) => patch(`${p}.autoEscalation`, next)}
          options={[
            { value: 'off', label: 'Off — manual only' },
            { value: '2-min', label: 'After 2 minutes' },
            { value: '5-min', label: 'After 5 minutes' },
            { value: '10-min', label: 'After 10 minutes' },
          ]}
        />
      </SettingRow>

      <SectionSubhead right="alert lifecycle">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight size={11} />
          Retention & sync
        </span>
      </SectionSubhead>

      <SettingRow
        label="Alert retention"
        hint="Resolved and dismissed alerts stay queryable for this period."
      >
        <SettingSlider
          ariaLabel="Alert retention"
          value={cfg.alertRetentionDays}
          meta={NUMERIC_META_OF(`${p}.alertRetentionDays`)}
          onChange={(next) => patch(`${p}.alertRetentionDays`, next)}
        />
      </SettingRow>

      <SettingRow
        label="Watchlist synchronization"
        hint="Push updated entries from the command centre out to edge nodes."
      >
        <SettingToggle
          checked={cfg.watchlistAutoSync}
          onChange={(next) => patch(`${p}.watchlistAutoSync`, next)}
          label="Watchlist synchronization"
          caption
        />
      </SettingRow>

      <SettingRow label="Sync interval" hint="How often edges reconcile watchlist deltas when auto-sync is on.">
        <div className={cfg.watchlistAutoSync ? '' : 'pointer-events-none opacity-40'}>
          <SettingSelect
            ariaLabel="Sync interval"
            value={cfg.syncIntervalMin}
            onChange={(next) => patch(`${p}.syncIntervalMin`, Number(next))}
            options={[
              { value: 15, label: 'Every 15 minutes' },
              { value: 30, label: 'Every 30 minutes' },
              { value: 60, label: 'Every hour' },
              { value: 240, label: 'Every 4 hours' },
              { value: 1440, label: 'Once a day' },
            ]}
          />
        </div>
      </SettingRow>

      <div className="pt-2">
        <InfoNote tone="amber" icon={RefreshCw}>
          Active priority bands: <strong>{cfg.priorityLevels.map(priorityLabel).join(', ') || 'none'}</strong> · last sync pushed 1,248
          entries to 214 edge nodes at 09:18 IST (mock).
        </InfoNote>
      </div>
    </SectionPanel>
  );
}
