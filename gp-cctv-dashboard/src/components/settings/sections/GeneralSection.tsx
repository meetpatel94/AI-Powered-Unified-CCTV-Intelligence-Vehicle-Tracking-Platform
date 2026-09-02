import { Building2, Clock3, MonitorCog } from 'lucide-react';

import {
  DATE_FORMAT_OPTIONS,
  SECTION_META,
  TIME_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingTextInput,
} from '@/components/settings/SettingPrimitives';

import type { GeneralConfig, SettingValue } from '@/types/settings';

interface GeneralSectionProps {
  cfg: GeneralConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'general';

const COMMAND_LOCATIONS = [
  'Gandhinagar State Command Centre',
  'Ahmedabad Zone Command',
  'Vadodara Zone Command',
  'Surat Zone Command',
  'Rajkot Zone Command',
  'Bhavnagar District HQ',
  'Distributed — multi-node mesh',
];

/** Platform identity, locale and console presentation. */
export function GeneralSection({ cfg, patch, pending }: GeneralSectionProps) {
  const meta = SECTION_META.general;
  const nameError =
    cfg.platformName.trim().length === 0
      ? 'Platform name is required'
      : cfg.platformName.trim().length < 3
        ? 'Platform name must be at least 3 characters'
        : null;

  return (
    <SectionPanel
      id="section-general"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
    >
      <SectionSubhead right="shown in console title bar">
        <span className="flex items-center gap-1.5">
          <Building2 size={11} />
          Identity & command
        </span>
      </SectionSubhead>

      <SettingRow
        label="Platform name"
        hint="Display name used across the console, reports and evidence exports."
        required
        error={nameError}
      >
        <SettingTextInput
          value={cfg.platformName}
          onChange={(next) => patch(`${p}.platformName`, next)}
          placeholder="e.g. Gujarat Police Unified CCTV Platform"
          error={nameError}
          maxLength={64}
        />
      </SettingRow>

      <SettingRow
        label="Command location"
        hint="Primary command centre that owns this configuration instance."
      >
        <SettingSelect
          ariaLabel="Command location"
          value={cfg.commandLocation}
          onChange={(next) => patch(`${p}.commandLocation`, next)}
          options={COMMAND_LOCATIONS.map((label) => ({ value: label, label }))}
        />
      </SettingRow>

      <SectionSubhead right="locale affects every timestamp">
        <span className="flex items-center gap-1.5">
          <Clock3 size={11} />
          Locale & clock
        </span>
      </SectionSubhead>

      <SettingRow label="Timezone" hint="Stored timestamps stay UTC; this governs display and alert schedules.">
        <SettingSelect
          ariaLabel="Timezone"
          value={cfg.timezone}
          onChange={(next) => patch(`${p}.timezone`, next)}
          options={TIMEZONE_OPTIONS.map((label) => ({ value: label, label }))}
        />
      </SettingRow>

      <SettingRow label="Date format" hint="Used in tables, evidence folders and exported reports.">
        <SettingSelect
          ariaLabel="Date format"
          value={cfg.dateFormat}
          onChange={(next) => patch(`${p}.dateFormat`, next)}
          options={DATE_FORMAT_OPTIONS.map((label) => ({ value: label, label }))}
        />
      </SettingRow>

      <SettingRow label="Time format" hint="Command consoles typically run 24-hour; control rooms often prefer 12-hour.">
        <SettingSelect
          ariaLabel="Time format"
          value={cfg.timeFormat}
          onChange={(next) => patch(`${p}.timeFormat`, next)}
          options={TIME_FORMAT_OPTIONS.map((label) => ({ value: label, label }))}
        />
      </SettingRow>

      <SettingRow
        label="Auto-refresh interval"
        hint="How often live panels poll telemetry. Lower values increase stream-gateway load."
      >
        <SettingSelect
          ariaLabel="Auto-refresh interval"
          value={cfg.autoRefreshSec}
          onChange={(next) => patch(`${p}.autoRefreshSec`, Number(next))}
          options={[2, 5, 10, 15, 30, 60].map((sec) => ({
            value: sec,
            label: sec >= 60 ? 'every 60 s' : `every ${sec} s`,
          }))}
        />
      </SettingRow>

      <SectionSubhead right="applies to the whole console">
        <span className="flex items-center gap-1.5">
          <MonitorCog size={11} />
          Console theme
        </span>
      </SectionSubhead>

      <SettingRow
        label="Theme"
        hint="Three calibrated dark profiles tuned for long surveillance shifts — no light mode."
      >
        <SettingSegmented
          ariaLabel="Console theme"
          value={cfg.theme}
          onChange={(next) => patch(`${p}.theme`, next)}
          options={[
            { value: 'navy', label: 'Command Navy' },
            { value: 'midnight', label: 'Midnight' },
            { value: 'contrast', label: 'High Contrast' },
          ]}
        />
      </SettingRow>
    </SectionPanel>
  );
}
