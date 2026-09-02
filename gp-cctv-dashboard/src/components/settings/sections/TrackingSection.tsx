import { Camera, Link2, Waypoints } from 'lucide-react';

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

import type { SettingValue, TrackingConfig } from '@/types/settings';

interface TrackingSectionProps {
  cfg: TrackingConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'tracking';

const JOURNEY_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '72h', label: 'Last 72 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

/** Journey reconstruction across the camera network. */
export function TrackingSection({ cfg, patch, pending }: TrackingSectionProps) {
  const meta = SECTION_META.tracking;
  const trackingOff = !cfg.trackingEnabled;
  const matchingOff = trackingOff || !cfg.crossCameraMatching;
  return (
    <SectionPanel
      id="section-tracking"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={
        <StateChip tone="green">
          <Waypoints size={11} /> 61.4k journeys tracked today
        </StateChip>
      }
    >
      <SectionSubhead right="per-vehicle track pipeline">
        <span className="flex items-center gap-1.5">
          <Waypoints size={11} />
          Tracker
        </span>
      </SectionSubhead>

      <SettingRow
        label="Vehicle tracking"
        hint="Master switch for continuous multi-camera vehicle tracking."
      >
        <SettingToggle checked={cfg.trackingEnabled} onChange={(next) => patch(`${p}.trackingEnabled`, next)} label="Vehicle tracking" caption />
      </SettingRow>

      <SettingRow
        label="Cross-camera matching"
        hint="Re-identify the same vehicle across adjacent cameras using Re-ID embeddings + plate."
      >
        <div className={trackingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingToggle
            checked={cfg.crossCameraMatching}
            onChange={(next) => patch(`${p}.crossCameraMatching`, next)}
            label="Cross-camera matching"
            caption
          />
        </div>
      </SettingRow>

      <SettingRow
        label="Tracker sensitivity"
        hint="Higher sensitivity re-associates tracks more aggressively — useful on crowded corridors, costs CPU."
      >
        <div className={matchingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingSlider
            ariaLabel="Tracker sensitivity"
            value={cfg.trackerSensitivity}
            meta={NUMERIC_META_OF(`${p}.trackerSensitivity`)}
            onChange={(next) => patch(`${p}.trackerSensitivity`, next)}
            readout={cfg.trackerSensitivity >= 80 ? 'aggressive' : cfg.trackerSensitivity >= 50 ? 'balanced' : 'conservative'}
          />
        </div>
      </SettingRow>

      <SettingRow
        label="Maximum tracking gap"
        hint="Longest blind interval a journey may survive before the track is closed."
      >
        <div className={matchingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingSlider
            ariaLabel="Maximum tracking gap"
            value={cfg.maxTrackingGapSec}
            meta={NUMERIC_META_OF(`${p}.maxTrackingGapSec`)}
            onChange={(next) => patch(`${p}.maxTrackingGapSec`, next)}
          />
        </div>
      </SettingRow>

      <SectionSubhead right="re-ID embedding · dim-256">
        <span className="flex items-center gap-1.5">
          <Link2 size={11} />
          Re-identification
        </span>
      </SectionSubhead>

      <SettingRow
        label="Re-ID confidence floor"
        hint="Minimum embedding similarity before two sightings join the same journey."
      >
        <div className={matchingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingSlider
            ariaLabel="Re-ID confidence floor"
            value={cfg.reidConfidenceMin}
            meta={NUMERIC_META_OF(`${p}.reidConfidenceMin`)}
            onChange={(next) => patch(`${p}.reidConfidenceMin`, next)}
          />
        </div>
      </SettingRow>

      <SettingRow label="Journey history duration" hint="How long journey timelines remain queryable before archival.">
        <div className={trackingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingSelect
            ariaLabel="Journey history duration"
            value={cfg.journeyHistory}
            onChange={(next) => patch(`${p}.journeyHistory`, next)}
            options={JOURNEY_OPTIONS}
          />
        </div>
      </SettingRow>

      <SettingRow label="Store journey snapshots" hint="Keep the best plate/vehicle frame per stop for the evidence bundle.">
        <div className={trackingOff ? 'pointer-events-none opacity-40' : ''}>
          <SettingToggle
            checked={cfg.storeSnapshots}
            onChange={(next) => patch(`${p}.storeSnapshots`, next)}
            label="Store journey snapshots"
            caption
          />
        </div>
      </SettingRow>

      <div className="flex items-center gap-2 border-t border-edge/40 pt-2.5 text-[11px] text-ink-faint">
        <Camera size={12} className="shrink-0 text-accent-cyan" />
        Tracking spans {cfg.trackingEnabled ? 'every district feed' : 'no feeds (disabled)'} · mock telemetry — live tracker stats arrive on the
        WebSocket once the RTSP/AI backends connect.
      </div>
    </SectionPanel>
  );
}
