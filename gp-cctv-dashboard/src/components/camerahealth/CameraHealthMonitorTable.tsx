import { useMemo } from 'react';
import { Cpu, ScanLine, TriangleAlert } from 'lucide-react';

import { HealthBar, StatusPill, Telemetry } from '@/components/camerahealth/HealthPrimitives';
import { toneInk } from '@/components/camerahealth/healthTones';
import { Panel } from '@/components/common/Panel';
import { statusMeta, transportMeta } from '@/data/cameraHealthData';

import type { HealthCamera, HealthEvaluation, HealthSettings } from '@/types/cameraHealth';

interface CameraHealthMonitorTableProps {
  cameras: HealthCamera[];
  evaluations: Record<string, HealthEvaluation>;
  settings: HealthSettings;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Total fleet size, shown in the header alongside the filtered count. */
  fleetTotal: number;
  shown: number;
}

const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-edge bg-[#0a1120] px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.09em] text-ink-faint';
const td = 'whitespace-nowrap px-1.5 py-[5px] align-middle';

/**
 * CAMERA HEALTH MONITOR — the dense grid at the centre of the console.
 * One row per monitored feed with a live health bar and technical telemetry.
 */
export function CameraHealthMonitorTable({
  cameras,
  evaluations,
  settings,
  selectedId,
  onSelect,
  fleetTotal,
  shown,
}: CameraHealthMonitorTableProps) {
  const needsAttention = useMemo(
    () => cameras.filter((camera) => evaluations[camera.id]?.attention).length,
    [cameras, evaluations],
  );

  return (
    <Panel
      title="Camera Health Monitor"
      className="h-full min-h-0"
      bodyClassName="flex flex-col"
      tools={
        <span className="tnum flex items-center gap-2 font-mono text-[9.5px] text-ink-faint">
          <span>
            <span className="text-[#9fc7ff]">{shown}</span> feeds
          </span>
          <span className="text-edge-strong">·</span>
          <span>fleet {fleetTotal.toLocaleString('en-IN')}</span>
          <span className="text-edge-strong">·</span>
          <span className={needsAttention ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'}>
            {needsAttention} flagged · warn &gt; {settings.latencyWarnMs} ms / {settings.lossWarnPct}% loss
          </span>
        </span>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-[10.5px]">
          <thead>
            <tr>
              <th className={`${th} left-0 z-20 pl-3`}>Camera ID</th>
              <th className={th}>Location</th>
              <th className={th}>Department</th>
              <th className={th}>Status</th>
              <th className={th}>Stream</th>
              <th className={`${th} text-right`}>FPS</th>
              <th className={th}>Resolution</th>
              <th className={th}>Codec</th>
              <th className={`${th} text-right`}>Latency</th>
              <th className={`${th} text-right`}>Bitrate</th>
              <th className={`${th} text-right`}>Packet Loss</th>
              <th className={th}>Last Heartbeat</th>
              <th className={th}>AI / ANPR</th>
              <th className={`${th} pr-3 text-right`}>Health</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((camera) => {
              const evaluation = evaluations[camera.id];
              const selected = camera.id === selectedId;
              const transport = transportMeta[camera.stream];
              const offline = camera.status === 'offline';
              return (
                <tr
                  key={camera.id}
                  onClick={() => onSelect(camera.id)}
                  className={`group cursor-pointer transition-colors ${
                    selected ? 'bg-[#12233f]/70' : 'hover:bg-panel-hover/60'
                  }`}
                >
                  {/* Camera ID */}
                  <td
                    className={`${td} sticky left-0 z-[1] border-b border-edge-soft/70 pl-3 ${
                      selected ? 'bg-[#12233f] shadow-[inset_2px_0_0_0_#22d3ee]' : 'bg-[#0b1222]'
                    } group-hover:bg-[#101a2e]`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-[2px] shrink-0 rounded-full"
                        style={{ backgroundColor: statusMeta[camera.status].color, boxShadow: `0 0 6px -1px ${statusMeta[camera.status].color}` }}
                      />
                      <span className="font-mono text-[10.5px] font-semibold text-white">{camera.id}</span>
                      {evaluation && evaluation.attention ? <TriangleAlert size={10} className="shrink-0 text-[#f7b95f]" /> : null}
                    </span>
                  </td>

                  {/* Location */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="block max-w-[168px] truncate text-[10.5px] text-[#d7e1f1]">{camera.location}</span>
                    <span className="block truncate text-[9px] text-ink-faint">
                      {camera.area} · {camera.city} · {camera.zone}
                    </span>
                  </td>

                  {/* Department */}
                  <td className={`${td} max-w-[112px] truncate border-b border-edge-soft/70 text-[10px] text-ink-dim`} title={camera.department}>
                    {camera.department}
                  </td>

                  {/* Status */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <StatusPill status={camera.status} size="xs" />
                  </td>

                  {/* Stream */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="font-mono text-[10px]" style={{ color: toneInk[transport.tone] }}>
                      {transport.label}
                    </span>
                    <span className="block font-mono text-[8.5px] text-ink-faint">
                      {camera.rtsp.transport} · {camera.hls.state === 'serving' ? `HLS ${camera.hls.segmentSec}s` : `HLS ${camera.hls.state}`} ·{' '}
                      {camera.webrtc.state === 'unavailable' ? 'no WebRTC' : 'WebRTC'}
                    </span>
                  </td>

                  {/* FPS */}
                  <td className={`${td} border-b border-edge-soft/70 text-right`}>
                    <Telemetry value={offline ? '—' : camera.fps.toFixed(1)} unit="fps" tone={evaluation?.fpsTone} />
                    <span className="block font-mono text-[8.5px] text-ink-faint">target {camera.fpsTarget}</span>
                  </td>

                  {/* Resolution */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="font-mono text-[10px] text-[#c3cfe2]">{camera.resolution}</span>
                    <span className="block font-mono text-[8.5px] text-ink-faint">{camera.resolutionClass}</span>
                  </td>

                  {/* Codec */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="rounded-[3px] border border-edge bg-[#0d1526] px-1 py-[1px] font-mono text-[9px] text-[#9fc7ff]">{camera.codec}</span>
                  </td>

                  {/* Latency */}
                  <td className={`${td} border-b border-edge-soft/70 text-right`}>
                    <Telemetry value={offline ? '—' : camera.latencyMs} unit="ms" tone={evaluation?.latencyTone} />
                    <span className="block font-mono text-[8.5px] text-ink-faint">jit {camera.jitterMs} ms</span>
                  </td>

                  {/* Bitrate */}
                  <td className={`${td} border-b border-edge-soft/70 text-right`}>
                    <Telemetry value={offline ? '—' : camera.bitrateMbps.toFixed(2)} unit="Mb/s" muted={offline} />
                    <span className="block font-mono text-[8.5px] text-ink-faint">buf {camera.bufferMs} ms</span>
                  </td>

                  {/* Packet loss */}
                  <td className={`${td} border-b border-edge-soft/70 text-right`}>
                    <Telemetry value={camera.packetLoss.toFixed(2)} unit="%" tone={evaluation?.lossTone} />
                  </td>

                  {/* Heartbeat */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${offline ? 'bg-accent-red' : 'bg-accent-green animate-pulse-dot'}`}
                        style={offline ? undefined : { boxShadow: '0 0 6px -1px #22c55e' }}
                      />
                      <span className="font-mono text-[10px] text-[#c3cfe2]">{camera.lastHeartbeat}</span>
                    </span>
                    <span className="block font-mono text-[8.5px] text-ink-faint">up {camera.uptime}</span>
                  </td>

                  {/* AI / ANPR */}
                  <td className={`${td} border-b border-edge-soft/70`}>
                    <span className="flex items-center gap-1">
                      <Cpu size={10} className={camera.ai.aiDetection ? 'text-[#6fe0b0]' : 'text-ink-faint'} />
                      <span className="font-mono text-[9.5px]" style={{ color: camera.ai.aiDetection ? '#6fe0b0' : '#7f92b0' }}>
                        {camera.ai.aiDetection ? `AI ${camera.ai.lastInferenceMs} ms` : 'AI off'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <ScanLine size={10} className={camera.ai.anprActive ? 'text-[#9fc7ff]' : 'text-ink-faint'} />
                      <span className="font-mono text-[9.5px]" style={{ color: camera.ai.anprActive ? '#9fc7ff' : '#7f92b0' }}>
                        {camera.ai.anprActive ? `ANPR q${camera.ai.queueDepth}` : 'ANPR off'}
                      </span>
                    </span>
                  </td>

                  {/* Health */}
                  <td className={`${td} border-b border-edge-soft/70 pr-3 text-right`}>
                    <span className="inline-flex justify-end">
                      <HealthBar score={evaluation?.score ?? 0} tone={evaluation?.tone ?? 'green'} live={!offline && evaluation?.score !== 100} />
                    </span>
                    <span className="block truncate font-mono text-[8.5px] text-ink-faint" title={evaluation?.reasons.join(' · ')}>
                      {offline ? 'no signal' : evaluation?.reasons[0]}
                    </span>
                  </td>
                </tr>
              );
            })}

            {cameras.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-[11px] text-ink-faint">
                  No cameras match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
