import { Film, Radio, Video } from 'lucide-react';

import {
  FPS_OPTIONS,
  NUMERIC_META_OF,
  RESOLUTION_OPTIONS,
  SECTION_META,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingNumberInput,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { CameraStreamsConfig, SettingValue } from '@/types/settings';

interface CameraStreamsSectionProps {
  cfg: CameraStreamsConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'cameras';

/** RTSP ingest, transport fallbacks and stream-profile defaults. */
export function CameraStreamsSection({ cfg, patch, pending }: CameraStreamsSectionProps) {
  const meta = SECTION_META.cameras;
  return (
    <SectionPanel
      id="section-cameras"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="cyan">fleet 12,842 · edge 214 nodes</StateChip>}
    >
      <SectionSubhead right="applies per stream URL">
        <span className="flex items-center gap-1.5">
          <Radio size={11} />
          RTSP ingest resilience
        </span>
      </SectionSubhead>

      <SettingRow
        label="Connection timeout"
        hint="Seconds the gateway waits for an RTSP handshake before failing the session."
      >
        <SettingNumberInput
          path={`${p}.rtspTimeoutSec`}
          value={cfg.rtspTimeoutSec}
          meta={NUMERIC_META_OF(`${p}.rtspTimeoutSec`)}
          onChange={(next) => patch(`${p}.rtspTimeoutSec`, next)}
        />
      </SettingRow>

      <SettingRow
        label="Reconnect attempts"
        hint="How many times the edge watchdog retries a dropped feed before marking it offline."
      >
        <SettingNumberInput
          path={`${p}.reconnectAttempts`}
          value={cfg.reconnectAttempts}
          meta={NUMERIC_META_OF(`${p}.reconnectAttempts`)}
          onChange={(next) => patch(`${p}.reconnectAttempts`, next)}
        />
      </SettingRow>

      <SettingRow
        label="Exponential backoff"
        hint="Delay between retries doubles each attempt (2 s → 4 s → 8 s…) instead of hammering the camera."
      >
        <SettingToggle
          checked={cfg.exponentialBackoff}
          onChange={(next) => patch(`${p}.exponentialBackoff`, next)}
          label="Exponential backoff"
          caption
        />
      </SettingRow>

      <SettingRow label="Default protocol" hint="Transport preference announced to cameras without a fixed profile.">
        <SettingSegmented
          ariaLabel="Default RTSP protocol"
          value={cfg.defaultProtocol}
          onChange={(next) => patch(`${p}.defaultProtocol`, next)}
          options={[
            { value: 'TCP', label: 'TCP', hint: 'Reliable over lossy links' },
            { value: 'UDP', label: 'UDP', hint: 'Lowest latency' },
            { value: 'Auto', label: 'Auto', hint: 'Negotiated per stream' },
          ]}
        />
      </SettingRow>

      <SectionSubhead right="codec decode is per-edge-node">
        <span className="flex items-center gap-1.5">
          <Film size={11} />
          Codecs & preview transport
        </span>
      </SectionSubhead>

      <SettingRow label="H.264 support" hint="Primary codec — mandated for all Gujarat Police CCTV feeds.">
        <SettingToggle checked={cfg.h264Support} onChange={(next) => patch(`${p}.h264Support`, next)} label="H.264 support" caption />
      </SettingRow>

      <SettingRow
        label="H.265 support"
        hint="HEVC halves bandwidth on 4K nodes. Requires hardware decode on the edge GPU."
      >
        <SettingToggle checked={cfg.h265Support} onChange={(next) => patch(`${p}.h265Support`, next)} label="H.265 support" caption />
      </SettingRow>

      <SettingRow label="WebRTC preview" hint="Sub-second latency preview for live tiles when the browser supports it.">
        <SettingToggle checked={cfg.webrtcPreview} onChange={(next) => patch(`${p}.webrtcPreview`, next)} label="WebRTC preview" caption />
      </SettingRow>

      <SettingRow label="HLS fallback" hint="Serves low-latency HLS when WebRTC is unavailable (older consoles, firewalls).">
        <SettingToggle checked={cfg.hlsFallback} onChange={(next) => patch(`${p}.hlsFallback`, next)} label="HLS fallback" caption />
      </SettingRow>

      <SectionSubhead right="global caps — per-role overrides exist">
        <span className="flex items-center gap-1.5">
          <Video size={11} />
          Stream profile
        </span>
      </SectionSubhead>

      <SettingRow
        label="Maximum concurrent streams"
        hint="Hard ceiling for open sessions across all gateways. Raising it needs stream-budget approval."
      >
        <SettingNumberInput
          path={`${p}.maxConcurrentStreams`}
          value={cfg.maxConcurrentStreams}
          meta={NUMERIC_META_OF(`${p}.maxConcurrentStreams`)}
          onChange={(next) => patch(`${p}.maxConcurrentStreams`, next)}
        />
      </SettingRow>

      <SettingRow label="Default resolution" hint="Requested decode resolution for cameras that expose multiple profiles.">
        <SettingSelect
          ariaLabel="Default resolution"
          value={cfg.defaultResolution}
          onChange={(next) => patch(`${p}.defaultResolution`, next)}
          options={RESOLUTION_OPTIONS}
        />
      </SettingRow>

      <SettingRow label="Target frame rate" hint="FPS the gateway requests from the RTSP profile when unset per camera.">
        <SettingSelect
          ariaLabel="Target frame rate"
          value={cfg.targetFps}
          onChange={(next) => patch(`${p}.targetFps`, Number(next))}
          options={FPS_OPTIONS}
        />
      </SettingRow>
    </SectionPanel>
  );
}
