import { Cpu, Layers3, Zap } from 'lucide-react';

import {
  CLASS_OPTIONS,
  NUMERIC_META_OF,
  SECTION_META,
} from '@/data/settingsData';

import {
  InfoNote,
  SectionPanel,
  SectionSubhead,
  SettingChips,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { AiDetectionConfig, SettingValue } from '@/types/settings';

interface AiDetectionSectionProps {
  cfg: AiDetectionConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'ai';

const classLabel = (value: string) => CLASS_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Vehicle-inference engine tuning (YOLO-class detector mock). */
export function AiDetectionSection({ cfg, patch, pending }: AiDetectionSectionProps) {
  const meta = SECTION_META.ai;
  return (
    <SectionPanel
      id="section-ai"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="purple">YOLOv9x · v3 · 4 inference nodes</StateChip>}
    >
      <SectionSubhead right="detector consumes 1 frame per interval">
        <span className="flex items-center gap-1.5">
          <Zap size={11} />
          Detection engine
        </span>
      </SectionSubhead>

      <SettingRow
        label="Vehicle detection"
        hint="Master switch for the vehicle/pedestrian detector across every active feed."
      >
        <SettingToggle
          checked={cfg.vehicleDetectionEnabled}
          onChange={(next) => patch(`${p}.vehicleDetectionEnabled`, next)}
          label="Vehicle detection"
          caption
        />
      </SettingRow>

      <SettingRow label="Inference mode" hint="Where the model runs. GPU is the default for 4× A100 edge nodes.">
        <SettingSegmented
          ariaLabel="Inference mode"
          value={cfg.computeMode}
          onChange={(next) => patch(`${p}.computeMode`, next)}
          options={[
            { value: 'gpu', label: 'GPU · CUDA' },
            { value: 'cpu', label: 'CPU · OpenVINO' },
            { value: 'auto', label: 'Auto-detect' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Inference FPS" hint="Detector throughput ceiling per node. Higher FPS costs GPU headroom.">
        <SettingSelect
          ariaLabel="Inference FPS"
          value={cfg.inferenceFps}
          onChange={(next) => patch(`${p}.inferenceFps`, Number(next))}
          options={[10, 15, 25, 30, 45, 60].map((fps) => ({ value: fps, label: `${fps} FPS` }))}
        />
      </SettingRow>

      <SettingRow
        label="Processing interval"
        hint="Frame sampling sent to the model — keyed by motion on busy corridors."
      >
        <SettingSelect
          ariaLabel="Processing interval"
          value={cfg.processingInterval}
          onChange={(next) => patch(`${p}.processingInterval`, next)}
          options={[
            { value: 'every-frame', label: 'Every frame' },
            { value: 'every-2nd', label: 'Every 2nd frame' },
            { value: '250ms', label: '4 samples / second' },
            { value: '500ms', label: '2 samples / second' },
            { value: '1s', label: '1 sample / second' },
            { value: 'motion', label: 'Motion-triggered only' },
          ]}
        />
      </SettingRow>

      <SectionSubhead right={`${cfg.classes.length} class${cfg.classes.length === 1 ? '' : 'es'} active`}>
        <span className="flex items-center gap-1.5">
          <Layers3 size={11} />
          Classes & sensitivity
        </span>
      </SectionSubhead>

      <SettingRow
        label="Confidence threshold"
        hint={`Detections below ${cfg.confidenceMin}% go to the low-confidence review queue instead of alerting.`}
      >
        <SettingSlider
          ariaLabel="Confidence threshold"
          value={cfg.confidenceMin}
          meta={NUMERIC_META_OF(`${p}.confidenceMin`)}
          onChange={(next) => patch(`${p}.confidenceMin`, next)}
        />
      </SettingRow>

      <SettingRow label="Detection classes" hint="Object classes the AI engine tracks. Keep at least one class enabled.">
        <SettingChips
          ariaLabel="Detection classes"
          value={cfg.classes}
          onChange={(next) => patch(`${p}.classes`, next)}
          options={CLASS_OPTIONS}
        />
      </SettingRow>

      <div className="pt-2">
        <InfoNote tone="cyan" icon={Cpu}>
          In this mock the engine reports <strong className="text-[#c7ecf7]">7.1 ms median inference</strong> on GPU nodes with the
          current profile · active classes:{' '}
          <span className="text-[#c7ecf7]">{cfg.classes.map(classLabel).join(', ') || 'none'}</span>
        </InfoNote>
      </div>
    </SectionPanel>
  );
}
