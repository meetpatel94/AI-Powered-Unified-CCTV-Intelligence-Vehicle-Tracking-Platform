import { ScanLine, Timer } from 'lucide-react';

import {
  NUMERIC_META_OF,
  PLATE_FORMAT_OPTIONS,
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

import type { AnprOcrConfig, SettingValue } from '@/types/settings';

interface AnprOcrSectionProps {
  cfg: AnprOcrConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'anpr';

const formatLabel = (value: string) => PLATE_FORMAT_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** ANPR / OCR recognition tuning for the plate-reading pipeline. */
export function AnprOcrSection({ cfg, patch, pending }: AnprOcrSectionProps) {
  const meta = SECTION_META.anpr;
  return (
    <SectionPanel
      id="section-anpr"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="green">3,842 ANPR feeds live</StateChip>}
    >
      <SectionSubhead right="OCR stack · v9.4.1">
        <span className="flex items-center gap-1.5">
          <ScanLine size={11} />
          Recognition engine
        </span>
      </SectionSubhead>

      <SettingRow
        label="ANPR engine"
        hint="Master switch for plate recognition on ANPR-enabled junction feeds."
      >
        <SettingToggle checked={cfg.anprEnabled} onChange={(next) => patch(`${p}.anprEnabled`, next)} label="ANPR engine" caption />
      </SettingRow>

      <SettingRow
        label="OCR confidence threshold"
        hint="Reads scoring below this are treated as uncertain and routed per the low-confidence policy."
      >
        <SettingSlider
          ariaLabel="OCR confidence threshold"
          value={cfg.ocrConfidenceMin}
          meta={NUMERIC_META_OF(`${p}.ocrConfidenceMin`)}
          onChange={(next) => patch(`${p}.ocrConfidenceMin`, next)}
        />
      </SettingRow>

      <SettingRow label="Plate formats" hint="Accepted number-plate layouts. Formats outside the list are ignored.">
        <SettingChips
          ariaLabel="Plate formats"
          value={cfg.plateFormats}
          onChange={(next) => patch(`${p}.plateFormats`, next)}
          options={PLATE_FORMAT_OPTIONS}
        />
      </SettingRow>

      <SettingRow
        label="Recognition frequency"
        hint="How often passing vehicles are read. Continuous maximizes capture on fast corridors."
      >
        <SettingSelect
          ariaLabel="Recognition frequency"
          value={cfg.recognitionFrequency}
          onChange={(next) => patch(`${p}.recognitionFrequency`, next)}
          options={[
            { value: 'continuous', label: 'Continuous' },
            { value: '250ms', label: 'Every 250 ms' },
            { value: '500ms', label: 'Every 500 ms' },
            { value: 'motion', label: 'On motion only' },
            { value: 'stop-line', label: 'At stop line' },
          ]}
        />
      </SettingRow>

      <SectionSubhead right="keeps alert noise low">
        <span className="flex items-center gap-1.5">
          <Timer size={11} />
          Duplicates & uncertainty
        </span>
      </SectionSubhead>

      <SettingRow
        label="Duplicate suppression"
        hint="The same plate read twice inside the suppression window becomes one event."
      >
        <SettingToggle
          checked={cfg.duplicateSuppression}
          onChange={(next) => patch(`${p}.duplicateSuppression`, next)}
          label="Duplicate suppression"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Suppression window"
        hint="Events for an identical plate within this window collapse into a single record."
      >
        <div className={cfg.duplicateSuppression ? '' : 'pointer-events-none opacity-40'}>
          <SettingSlider
            ariaLabel="Suppression window"
            value={cfg.duplicateWindowSec}
            meta={NUMERIC_META_OF(`${p}.duplicateWindowSec`)}
            onChange={(next) => patch(`${p}.duplicateWindowSec`, next)}
          />
        </div>
      </SettingRow>

      <SettingRow
        label="Low-confidence handling"
        hint="What happens to reads between the fallback floor and the confidence threshold."
      >
        <SettingSelect
          ariaLabel="Low-confidence handling"
          value={cfg.lowConfidenceHandling}
          onChange={(next) => patch(`${p}.lowConfidenceHandling`, next)}
          options={[
            { value: 'review-queue', label: 'Review queue (manual)' },
            { value: 'discard', label: 'Discard silently' },
            { value: 'soft-alert', label: 'Raise low-confidence alert' },
            { value: 'fuzzy-normalise', label: 'Normalise + retry once' },
          ]}
        />
      </SettingRow>

      <div className="pt-2">
        <InfoNote tone="slate">
          Read formats recognised on this instance:{' '}
          <span className="text-[#c3cfe2]">{cfg.plateFormats.map(formatLabel).join('  ·  ') || 'none'}</span>
        </InfoNote>
      </div>
    </SectionPanel>
  );
}
