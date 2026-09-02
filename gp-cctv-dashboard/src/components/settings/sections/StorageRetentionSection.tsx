import { Archive, Database, HardDrive } from 'lucide-react';

import {
  NUMERIC_META_OF,
  SECTION_META,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { SettingValue, StorageRetentionConfig } from '@/types/settings';

interface StorageRetentionSectionProps {
  cfg: StorageRetentionConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'storage';

/** Evidence archive telemetry + retention schedules. */
export function StorageRetentionSection({ cfg, patch, pending }: StorageRetentionSectionProps) {
  const meta = SECTION_META.storage;
  return (
    <SectionPanel
      id="section-storage"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={
        <StateChip tone="green">
          <HardDrive size={11} /> 41 TB free · 74% used
        </StateChip>
      }
    >
      <div className="grid grid-cols-1 gap-2 border-b border-edge/40 py-3 md:grid-cols-2">
        <StorageBar label="Evidence store" used="9.2 TB" total="12 TB" pct={77} tone="#22c55e" warnPct={cfg.storageWarningPct} />
        <StorageBar label="Video archive" used="28.4 TB" total="40 TB" pct={71} tone="#2f7dff" warnPct={cfg.storageWarningPct} />
        <StorageBar label="Snapshot store" used="1.8 TB" total="2.5 TB" pct={72} tone="#22d3ee" warnPct={cfg.storageWarningPct} />
        <StorageBar label="Metadata DB" used="0.6 TB" total="0.75 TB" pct={82} tone="#a855f7" warnPct={cfg.storageWarningPct} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/40 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[6px] border border-accent-green/40 bg-accent-green/10">
            <Database size={14} className="text-[#4ade80]" />
          </span>
          <div>
            <div className="text-[12.5px] font-semibold text-[#dbe5f4]">PostgreSQL 16 · evidence cluster</div>
            <div className="text-[10.5px] text-ink-faint">3× primary · 6 replicas · replication lag 12 ms</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateChip tone="green" pulse>
            Operational
          </StateChip>
          <StateChip tone="cyan">4 ms latency</StateChip>
        </div>
      </div>

      <SectionSubhead right="lifecycle schedules">
        <span className="flex items-center gap-1.5">
          <Archive size={11} />
          Retention schedules
        </span>
      </SectionSubhead>

      <SettingRow label="Evidence retention" hint="Sealed evidence bundles (watchlist hits, cases) before cold-archive.">
        <SettingSlider
          ariaLabel="Evidence retention"
          value={cfg.evidenceRetentionDays}
          meta={NUMERIC_META_OF(`${p}.evidenceRetentionDays`)}
          onChange={(next) => patch(`${p}.evidenceRetentionDays`, next)}
        />
      </SettingRow>

      <SettingRow label="Snapshot retention" hint="ANPR & detection snapshots kept for re-review before purge.">
        <SettingSlider
          ariaLabel="Snapshot retention"
          value={cfg.snapshotRetentionDays}
          meta={NUMERIC_META_OF(`${p}.snapshotRetentionDays`)}
          onChange={(next) => patch(`${p}.snapshotRetentionDays`, next)}
        />
      </SettingRow>

      <SettingRow label="Video retention" hint="Rolling raw footage window across all camera channels.">
        <SettingSlider
          ariaLabel="Video retention"
          value={cfg.videoRetentionDays}
          meta={NUMERIC_META_OF(`${p}.videoRetentionDays`)}
          onChange={(next) => patch(`${p}.videoRetentionDays`, next)}
        />
      </SettingRow>

      <SettingRow label="Metadata retention" hint="Journey, track and event metadata stays queryable this long.">
        <SettingSelect
          ariaLabel="Metadata retention"
          value={cfg.metadataRetention}
          onChange={(next) => patch(`${p}.metadataRetention`, next)}
          options={[
            { value: '1y', label: '1 year' },
            { value: '2y', label: '2 years' },
            { value: '5y', label: '5 years' },
            { value: 'indefinite', label: 'Indefinite (archive)' },
          ]}
        />
      </SettingRow>

      <SectionSubhead right="storage engine · Ceph v18">
        <span className="flex items-center gap-1.5">
          <HardDrive size={11} />
          Cleanup & headroom
        </span>
      </SectionSubhead>

      <SettingRow
        label="Automatic cleanup"
        hint="Nightly janitor applies retention policies and defragments cold volumes."
      >
        <SettingToggle
          checked={cfg.automaticCleanup}
          onChange={(next) => patch(`${p}.automaticCleanup`, next)}
          label="Automatic cleanup"
          caption
        />
      </SettingRow>

      <SettingRow label="Cleanup window" hint="Scheduled slot for the janitor job (config-bus quiet hours).">
        <div className={cfg.automaticCleanup ? '' : 'pointer-events-none opacity-40'}>
          <SettingSelect
            ariaLabel="Cleanup window"
            value={cfg.cleanupWindow}
            onChange={(next) => patch(`${p}.cleanupWindow`, next)}
            options={[
              { value: '00:00 IST', label: '00:00–01:00 IST' },
              { value: '02:00 IST', label: '02:00–03:00 IST' },
              { value: '04:00 IST', label: '04:00–05:00 IST' },
              { value: 'Sunday 03:00 IST', label: 'Sunday 03:00–05:00 IST' },
            ]}
          />
        </div>
      </SettingRow>

      <SettingRow
        label="Storage warning threshold"
        hint="Crossing this fill level raises a STORAGE WARNING alert to the duty engineer."
      >
        <SettingSlider
          ariaLabel="Storage warning threshold"
          value={cfg.storageWarningPct}
          meta={NUMERIC_META_OF(`${p}.storageWarningPct`)}
          onChange={(next) => patch(`${p}.storageWarningPct`, next)}
        />
      </SettingRow>

      <SettingRow
        label="Compress archive volumes"
        hint="Zstandard compression on cold evidence volumes reclaims ~40% capacity."
      >
        <SettingToggle
          checked={cfg.compressArchive}
          onChange={(next) => patch(`${p}.compressArchive`, next)}
          label="Compress archive volumes"
          caption
        />
      </SettingRow>
    </SectionPanel>
  );
}

function StorageBar({
  label,
  used,
  total,
  pct,
  tone,
  warnPct,
}: {
  label: string;
  used: string;
  total: string;
  pct: number;
  tone: string;
  warnPct: number;
}) {
  const color = pct >= warnPct ? '#f59e0b' : tone;
  return (
    <div className="rounded-[6px] border border-edge bg-[#0c1424] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-[#c7d4e8]">{label}</span>
        <span className="tnum text-[10.5px] text-ink-faint">
          {used} <span className="text-[#4b5d80]">/ {total}</span>
        </span>
      </div>
      <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-[#16243c]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px -1px ${color}` }}
        />
      </div>
    </div>
  );
}
