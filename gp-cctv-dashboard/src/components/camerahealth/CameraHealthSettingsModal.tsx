import { useMemo, useState } from 'react';
import { RotateCcw, Save, ShieldAlert, X } from 'lucide-react';

import { defaultHealthSettings, evaluateCamera } from '@/data/cameraHealthData';

import type { HealthCamera, HealthSettings } from '@/types/cameraHealth';

interface CameraHealthSettingsModalProps {
  open: boolean;
  settings: HealthSettings;
  cameras: HealthCamera[];
  onClose: () => void;
  onApply: (next: HealthSettings) => void;
}

const inputCls =
  'h-[28px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[12.5px] text-ink outline-none transition-colors focus:border-accent-blue/70';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]';

/**
 * Health thresholds + polling behaviour. These numbers are the only input to
 * `evaluateCamera()`, so changing them immediately re-tones the monitor grid,
 * the location ranking and the critical list.
 */
export function CameraHealthSettingsModal({ open, settings, cameras, onClose, onApply }: CameraHealthSettingsModalProps) {
  const [draft, setDraft] = useState<HealthSettings>(settings);

  const impact = useMemo(() => {
    const flagged = cameras.filter((camera) => evaluateCamera(camera, draft).attention).length;
    const current = cameras.filter((camera) => evaluateCamera(camera, settings).attention).length;
    return { flagged, delta: flagged - current };
  }, [cameras, draft, settings]);

  if (!open) return null;

  const set = <K extends keyof HealthSettings>(key: K, value: HealthSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const numberField = (key: keyof HealthSettings, label: string, unit: string, step = 1, min = 0) => (
    <label className="block">
      <span className={labelCls}>
        {label} <span className="text-ink-faint">({unit})</span>
      </span>
      <input
        type="number"
        value={draft[key] as number}
        min={min}
        step={step}
        onChange={(event) => set(key, Number(event.target.value) as never)}
        className={inputCls}
      />
    </label>
  );

  const toggle = (key: 'autoRestart' | 'notifyCritical' | 'anprAlerts', label: string, hint: string) => (
    <button
      type="button"
      onClick={() => set(key, !draft[key])}
      className="flex w-full items-start gap-2 rounded-[4px] border border-edge bg-[#0c1424] px-2 py-1.5 text-left transition-colors hover:border-edge-strong"
    >
      <span
        className={`mt-[1px] grid h-[14px] w-[24px] shrink-0 place-items-center rounded-full border transition-colors ${
          draft[key] ? 'border-accent-blue/70 bg-accent-blue/30' : 'border-edge bg-[#101a2e]'
        }`}
      >
        <span className={`h-[10px] w-[10px] rounded-full transition-transform ${draft[key] ? 'translate-x-[5px] bg-accent-blue' : '-translate-x-[5px] bg-ink-faint'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-[#d7e1f1]">{label}</span>
        <span className="block text-[10.5px] leading-[11.5px] text-ink-faint">{hint}</span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#02040a]/78 p-4 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div
        className="panel w-full max-w-[560px] animate-drawer-in overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Camera health settings"
      >
        <header className="flex items-center justify-between border-b border-edge bg-panel-head px-3 py-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.09em] text-white">
            <ShieldAlert size={12} className="text-accent-cyan" />
            Health Thresholds & Polling
          </h2>
          <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-white" title="Close">
            <X size={14} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-3 py-2.5">
          <section>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">Stream quality thresholds</p>
            <div className="grid grid-cols-3 gap-2">
              {numberField('latencyWarnMs', 'Latency warn', 'ms', 10)}
              {numberField('latencyCritMs', 'Latency critical', 'ms', 10)}
              {numberField('fpsMinPct', 'Min FPS', '% of target', 1)}
              {numberField('lossWarnPct', 'Packet loss warn', '%', 0.1)}
              {numberField('lossCritPct', 'Packet loss critical', '%', 0.1)}
              {numberField('heartbeatWarnSec', 'Heartbeat warn', 'seconds', 1)}
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">Console</p>
            <label className="block">
              <span className={labelCls}>Telemetry refresh (seconds)</span>
              <select
                value={draft.refreshSec}
                onChange={(event) => set('refreshSec', Number(event.target.value))}
                className={inputCls}
              >
                {[1, 2, 5, 10, 15].map((sec) => (
                  <option key={sec} value={sec}>
                    every {sec} s
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">Automation</p>
            {toggle('autoRestart', 'Auto-restart degraded streams', 'Edge watchdog re-opens the RTSP session after three failed heartbeats.')}
            {toggle('notifyCritical', 'Alert on critical cameras', 'Raise an alert record for every camera crossing a critical threshold.')}
            {toggle('anprAlerts', 'ANPR pipeline alerts', 'Watch OCR queue depth and inference latency on every ANPR-enabled feed.')}
          </section>

          <p className="rounded-[4px] border border-edge bg-[#0a1120] px-2 py-1.5 text-[11.5px] leading-[13px] text-ink-dim">
            <span className="font-semibold text-[#9fc7ff]">Live impact · </span>
            these thresholds would flag{' '}
            <span className="tnum font-semibold text-white">{impact.flagged}</span> of {cameras.length} monitored feeds
            {impact.delta !== 0 ? (
              <span className={impact.delta > 0 ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'}>
                {' '}
                ({impact.delta > 0 ? '+' : ''}
                {impact.delta} vs current)
              </span>
            ) : (
              <span className="text-ink-faint"> (unchanged)</span>
            )}
            .
          </p>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-edge bg-panel-head px-3 py-2">
          <button
            type="button"
            onClick={() => setDraft(defaultHealthSettings)}
            className="flex h-[28px] items-center gap-1.5 rounded-[4px] border border-edge bg-panel px-2.5 text-[12px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            <RotateCcw size={11} />
            Restore defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-[28px] items-center rounded-[4px] border border-edge bg-panel px-3 text-[12px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="flex h-[28px] items-center gap-1.5 rounded-[4px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3 text-[12px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
            >
              <Save size={11} strokeWidth={2.4} />
              Apply thresholds
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
