import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CameraIcon, CameraOff, ChevronDown, Crosshair, ExternalLink, Info, RotateCw, Signal } from 'lucide-react';

import { HealthBar, Sparkline, SpecRow, StatusPill, Telemetry } from '@/components/camerahealth/HealthPrimitives';
import { toneInk } from '@/components/camerahealth/healthTones';
import { Panel } from '@/components/common/Panel';
import { transportMeta } from '@/data/cameraHealthData';
import { drift } from '@/hooks/useTelemetryTick';

import type { HealthCamera, HealthEvaluation } from '@/types/cameraHealth';

interface SelectedCameraHealthPanelProps {
  camera: HealthCamera | null;
  evaluation: HealthEvaluation | null;
  tick: number;
  busy: boolean;
  onRestart: (id: string) => void;
  onSnapshot: (id: string) => void;
}

const actionBtn =
  'flex h-[26px] flex-1 items-center justify-center gap-1 rounded-[4px] border border-edge bg-panel-alt px-2 text-[12px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-45';

function stateChip(state: string, tone: 'green' | 'amber' | 'red' | 'cyan') {
  const styles: Record<string, string> = {
    green: 'border-accent-green/45 bg-[#0b2e26] text-[#6fe0b0]',
    amber: 'border-accent-orange/45 bg-[#2b1a06] text-[#f7b95f]',
    red: 'border-accent-red/45 bg-[#2b0b10] text-[#ff8b96]',
    cyan: 'border-accent-blue/45 bg-[#12233f] text-[#9fc7ff]',
  };
  return (
    <span className={`rounded-[3px] border px-1 py-[1px] font-mono text-[11px] font-semibold uppercase ${styles[tone]}`}>{state}</span>
  );
}

/** Rolling window of a metric derived from the shared telemetry tick. */
function history(camera: HealthCamera, tick: number, field: 'fps' | 'latencyMs', points = 18): number[] {
  const base = camera[field];
  const spread = Math.max(field === 'fps' ? 0.6 : 12, base * 0.06);
  return Array.from({ length: points }, (_, i) =>
    Math.max(0, drift(base, spread, `${camera.id}:${field}:${tick - (points - 1 - i)}`, 0, field === 'fps' ? 1 : 0)),
  );
}

/**
 * SELECTED CAMERA HEALTH — right-hand inspector for the camera picked in the
 * monitor grid: preview, transport states (RTSP / WebRTC / HLS), technical
 * telemetry, AI + ANPR status and the four stream actions.
 */
export function SelectedCameraHealthPanel({ camera, evaluation, tick, busy, onRestart, onSnapshot }: SelectedCameraHealthPanelProps) {
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fpsHistory = useMemo(() => (camera ? history(camera, tick, 'fps') : []), [camera, tick]);
  const latencyHistory = useMemo(() => (camera ? history(camera, tick, 'latencyMs') : []), [camera, tick]);

  if (!camera || !evaluation) {
    return (
      <Panel title="Selected Camera Health">
        <div className="grid h-full min-h-[220px] place-items-center px-4 text-center">
          <div>
            <Crosshair size={20} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-[12.5px] text-ink-dim">Select a camera in the monitor grid</p>
            <p className="mt-1 text-[11.5px] text-ink-faint">
              RTSP / WebRTC / HLS state, stream telemetry, AI and ANPR pipeline health appear here.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const offline = camera.status === 'offline';
  const transport = transportMeta[camera.stream];

  return (
    <Panel
      title="Selected Camera Health"
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5"
      tools={
        <span className="flex items-center gap-1.5">
          <span className="tnum font-mono text-[11.5px] text-ink-faint">
            {camera.lat.toFixed(5)}, {camera.lng.toFixed(5)}
          </span>
          <StatusPill status={camera.status} size="xs" />
        </span>
      }
    >
      {/* preview + identity */}
      <div className="relative shrink-0 overflow-hidden rounded-[5px] border border-edge bg-[#070c16]">
        <div className="relative h-[112px]">
          <img
            src={camera.thumbnail}
            alt={`${camera.id} ${camera.location} preview`}
            className={`h-full w-full object-cover ${offline ? 'opacity-25 grayscale' : 'opacity-90'}`}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#070c16] via-transparent to-transparent" />
          {offline ? (
            <span className="absolute inset-0 grid place-items-center">
              <span className="flex flex-col items-center gap-1 rounded-[4px] border border-accent-red/40 bg-[#160709]/90 px-3 py-2">
                <CameraOff size={16} className="text-accent-red" />
                <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#ff8b96]">no video signal</span>
              </span>
            </span>
          ) : (
            <>
              <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-[3px] border border-accent-red/50 bg-black/60 px-1 py-[1px]">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                <span className="font-mono text-3xs font-bold tracking-[0.12em] text-white">LIVE</span>
              </span>
              <span className="absolute top-1.5 right-1.5 rounded-[3px] bg-black/55 px-1 py-[1px] font-mono text-3xs text-[#c3cfe2]">
                {camera.codec} · {camera.resolution}
              </span>
              <span className="absolute bottom-1.5 left-1.5 font-mono text-[11px] text-[#c3cfe2]">
                {camera.id} · {camera.location}
              </span>
              <span className="absolute right-1.5 bottom-1.5 font-mono text-[11px] text-[#9fc7ff]">{camera.city}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-edge bg-[#0a1120] px-2 py-1">
          <span className="truncate font-mono text-[12px] font-semibold text-white">{camera.id}</span>
          <span className="truncate text-[11.5px] text-ink-dim">{camera.location}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">health</span>
            <HealthBar score={evaluation.score} tone={evaluation.tone} width={44} />
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRestart(camera.id)}
          title="Tear down and re-open the RTSP session on the edge node"
          className="flex h-[26px] flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-2 text-[12px] font-semibold text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.85)] transition-all hover:brightness-110 disabled:opacity-50"
        >
          <RotateCw size={11} strokeWidth={2.4} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Restarting…' : 'Restart Stream'}
        </button>
        <button type="button" onClick={() => navigate('/live-view')} title="Open this feed in Live View" className={actionBtn}>
          <ExternalLink size={11} />
          View Live
        </button>
        <button type="button" onClick={() => onSnapshot(camera.id)} title="Grab a JPEG snapshot from the ingest buffer" className={actionBtn}>
          <CameraIcon size={11} />
          Snapshot
        </button>
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          title="Toggle full camera specifications"
          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
            detailsOpen ? 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff]' : 'border-edge bg-panel-alt text-[#8ea3c4] hover:text-white'
          }`}
        >
          <Info size={11} />
        </button>
      </div>

      {/* transport */}
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0a1120] px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
            <Signal size={10} className="text-ink-faint" />
            Ingest pipeline
          </span>
          <span className="font-mono text-[11.5px]" style={{ color: toneInk[transport.tone] }}>
            {transport.label}
          </span>
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-[4px] border border-edge-soft bg-[#0b1222] px-1.5 py-1">
            <span className="block text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">RTSP</span>
            {stateChip(
              camera.rtsp.state,
              camera.rtsp.state === 'connected' ? 'green' : camera.rtsp.state === 'timeout' ? 'red' : 'amber',
            )}
            <span className="mt-[2px] block truncate font-mono text-[10.5px] text-ink-faint" title={camera.rtsp.url}>
              {camera.rtsp.transport} · :554
            </span>
          </div>
          <div className="rounded-[4px] border border-edge-soft bg-[#0b1222] px-1.5 py-1">
            <span className="block text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">WebRTC</span>
            {stateChip(camera.webrtc.state, camera.webrtc.state === 'active' ? 'green' : camera.webrtc.state === 'fallback' ? 'amber' : 'red')}
            <span className="mt-[2px] block truncate font-mono text-[10.5px] text-ink-faint">
              {camera.webrtc.latencyMs ? `${camera.webrtc.latencyMs} ms` : '—'} · {camera.webrtc.iceCandidate ?? 'no ICE'}
            </span>
          </div>
          <div className="rounded-[4px] border border-edge-soft bg-[#0b1222] px-1.5 py-1">
            <span className="block text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">HLS</span>
            {stateChip(camera.hls.state, camera.hls.state === 'serving' ? 'green' : camera.hls.state === 'stale' ? 'amber' : 'red')}
            <span className="mt-[2px] block truncate font-mono text-[10.5px] text-ink-faint">
              {camera.hls.segmentSec ? `${camera.hls.segmentSec} s seg` : '—'} · lag {camera.hls.playlistLagSec?.toFixed(1) ?? '—'} s
            </span>
          </div>
        </div>
      </div>

      {/* live telemetry */}
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0a1120] px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Stream telemetry</span>
          <span className="font-mono text-[11px] text-ink-faint">last 90 s</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0">
          <SpecRow label="Codec" tone="cyan">
            {camera.codec}
          </SpecRow>
          <SpecRow label="Resolution">
            {camera.resolution}
          </SpecRow>
          <SpecRow label="FPS" tone={evaluation.fpsTone}>
            {offline ? '—' : `${camera.fps.toFixed(1)} / ${camera.fpsTarget}`}
          </SpecRow>
          <SpecRow label="Bitrate">
            {offline ? '—' : `${camera.bitrateMbps.toFixed(2)} Mb/s`}
          </SpecRow>
          <SpecRow label="Latency" tone={evaluation.latencyTone}>
            {offline ? '—' : `${camera.latencyMs} ms`}
          </SpecRow>
          <SpecRow label="Jitter">
            {offline ? '—' : `${camera.jitterMs} ms`}
          </SpecRow>
          <SpecRow label="Packet loss" tone={evaluation.lossTone}>
            {camera.packetLoss.toFixed(2)}%
          </SpecRow>
          <SpecRow label="Buffer">
            {offline ? '—' : `${camera.bufferMs} ms`}
          </SpecRow>
          <SpecRow label="Last heartbeat" tone={evaluation.heartbeatTone}>
            {camera.lastHeartbeat}
          </SpecRow>
          <SpecRow label="Uptime" tone={camera.uptimePct < 97 ? 'amber' : 'green'}>
            {camera.uptime} · {camera.uptimePct.toFixed(1)}%
          </SpecRow>
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div className="rounded-[4px] border border-edge-soft bg-[#0b1222] px-1.5 py-1">
            <span className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              fps trend
              <Telemetry value={camera.fps.toFixed(1)} unit="fps" tone={evaluation.fpsTone} />
            </span>
            <Sparkline values={fpsHistory} tone={evaluation.fpsTone} width={118} height={24} />
          </div>
          <div className="rounded-[4px] border border-edge-soft bg-[#0b1222] px-1.5 py-1">
            <span className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              latency
              <Telemetry value={camera.latencyMs} unit="ms" tone={evaluation.latencyTone} />
            </span>
            <Sparkline values={latencyHistory} tone={evaluation.latencyTone} width={118} height={24} />
          </div>
        </div>
      </div>

      {/* AI / ANPR */}
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0a1120] px-2 py-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">AI / ANPR pipeline</span>
        <div className="mt-1 grid grid-cols-2 gap-x-3">
          <SpecRow label="AI detection" tone={camera.ai.aiDetection ? 'green' : 'red'}>
            {camera.ai.aiDetection ? 'active' : 'stopped'}
          </SpecRow>
          <SpecRow label="ANPR" tone={camera.ai.anprActive ? 'green' : 'amber'}>
            {camera.ai.anprActive ? 'reading' : 'disabled'}
          </SpecRow>
          <SpecRow label="Model" tone="cyan">
            {camera.ai.model}
          </SpecRow>
          <SpecRow label="Version">{camera.ai.modelVersion}</SpecRow>
          <SpecRow label="Inference" tone={camera.ai.lastInferenceMs > 200 ? 'amber' : 'green'}>
            {camera.ai.lastInferenceMs} ms
          </SpecRow>
          <SpecRow label="Queue" tone={camera.ai.queueDepth > 10 ? 'red' : camera.ai.queueDepth > 4 ? 'amber' : 'green'}>
            {camera.ai.queueDepth} frames
          </SpecRow>
          <SpecRow label="GPU util" tone={camera.ai.gpuUtil > 90 ? 'red' : camera.ai.gpuUtil > 70 ? 'amber' : 'green'}>
            {camera.ai.gpuUtil}%
          </SpecRow>
          <SpecRow label="Frames processed">
            {camera.ai.fpsProcessed} fps
          </SpecRow>
        </div>
      </div>

      {/* reasons */}
      <div
        className="shrink-0 rounded-[5px] border px-2 py-1.5"
        style={{
          borderColor: `${evaluation.tone === 'green' ? '#22c55e' : evaluation.tone === 'amber' ? '#f59e0b' : evaluation.tone === 'red' ? '#ef4444' : '#2f7dff'}44`,
          backgroundColor: evaluation.tone === 'green' ? '#08180f' : evaluation.tone === 'amber' ? '#170f04' : evaluation.tone === 'red' ? '#170709' : '#08111f',
        }}
      >
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: toneInk[evaluation.tone] }}>
          {evaluation.attention ? 'Requires attention' : 'Subsystems nominal'}
        </span>
        <ul className="mt-1 space-y-[2px]">
          {evaluation.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-[11.5px] text-ink-dim">
              <span className="mt-[4px] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: toneInk[evaluation.tone] }} />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* expandable details */}
      {detailsOpen ? (
        <div className="shrink-0 animate-fade-in rounded-[5px] border border-edge bg-[#0a1120] px-2 py-1.5">
          <button
            type="button"
            onClick={() => setDetailsOpen(false)}
            className="flex w-full items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim transition-colors hover:text-white"
          >
            Camera details
            <ChevronDown size={12} className="rotate-180" />
          </button>
          <div className="mt-1 grid grid-cols-2 gap-x-3">
            <SpecRow label="IP address">{camera.ip}</SpecRow>
            <SpecRow label="Edge node" tone="cyan">
              {camera.edgeNode}
            </SpecRow>
            <SpecRow label="Firmware">{camera.firmware}</SpecRow>
            <SpecRow label="Installed">{camera.installDate}</SpecRow>
            <SpecRow label="Restarts 24 h" tone={camera.restarts24h >= 4 ? 'red' : camera.restarts24h > 0 ? 'amber' : 'green'}>
              {camera.restarts24h}
            </SpecRow>
            <SpecRow label="Zone">{camera.zone}</SpecRow>
            <SpecRow label="Department">{camera.department}</SpecRow>
            <SpecRow label="Geo">{`${camera.lat.toFixed(5)}, ${camera.lng.toFixed(5)}`}</SpecRow>
          </div>
          <p className="mt-1 break-all rounded-[3px] border border-edge-soft bg-[#0b1222] px-1.5 py-1 font-mono text-[10.5px] text-ink-faint">
            {camera.streamUrl}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
