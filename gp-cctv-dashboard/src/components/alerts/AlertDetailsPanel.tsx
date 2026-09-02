import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Check,
  Eye,
  Flag,
  LocateFixed,
  MapPin,
  Route,
  ScanSearch,
  ShieldCheck,
  X,
  ZoomIn,
} from 'lucide-react';

import type { AlertRecord } from '@/types/alerts';

import { ConfidenceBar, SeverityChip, StatusChip, TimelineRow } from './AlertChips';
import { severityBar } from './tones';

export type AlertDetailAction = 'acknowledge' | 'investigate' | 'track' | 'camera' | 'escalate' | 'resolve';

interface AlertDetailsPanelProps {
  alert: AlertRecord | null;
  onClose: () => void;
  onAction: (alert: AlertRecord, action: AlertDetailAction, payload?: string) => void;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">{label}</div>
      <div className={`mt-[2px] truncate text-[12.5px] font-medium text-[#dbe6f5] ${mono ? 'tnum tracking-[0.04em]' : ''}`}>
        {value}
      </div>
    </div>
  );
}

/** Right-side ALERT DETAILS workspace: evidence, telemetry, journey, response log, actions. */
export function AlertDetailsPanel({ alert, onClose, onAction }: AlertDetailsPanelProps) {
  const navigate = useNavigate();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!alert) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [alert, onClose]);

  if (!alert) return null;

  const Icon = alert.icon;
  const resolved = alert.status === 'resolved';
  const evidence = [alert.thumbnail, ...alert.evidence];
  const activeIndex = frame % evidence.length;
  const activeFrame = evidence[activeIndex];

  const btn =
    'flex h-[28px] items-center justify-center gap-1.5 rounded-[5px] border text-[11.5px] font-semibold uppercase tracking-[0.05em] transition-all disabled:cursor-not-allowed disabled:opacity-40';
  const ghost = 'border-edge bg-[#0c1424] text-[#c3cfe2] hover:border-edge-strong hover:text-white';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close alert details"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-[min(520px,94vw)] animate-drawer-in flex-col border-l border-edge bg-[#0a1120] shadow-[0_0_40px_rgba(0,0,0,0.65)]">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[6px] border border-accent-red/40 bg-accent-red/15">
              <Icon size={13} className="text-accent-red" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-bold uppercase tracking-[0.06em] text-white">{alert.title}</span>
                <SeverityChip severity={alert.severity} />
                <StatusChip status={alert.status} />
              </div>
              <div className="tnum text-[11px] text-ink-dim">
                {alert.id} · logged {alert.time} ({alert.ago})
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[5px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {/* evidence hero */}
          <div className="relative h-[196px] overflow-hidden rounded-md border border-edge bg-[#0c1424]">
            <img src={activeFrame} alt={`${alert.id} evidence frame`} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-sweep bg-gradient-to-b from-accent-cyan/10 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#05070f]/95 to-transparent" />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-[3px] bg-black/70 px-1.5 py-px text-[10.5px] font-bold text-[#9fb0cc] ring-1 ring-edge-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-dot" /> {alert.camera} · CAM SNAPSHOT
            </span>
            <span className="tnum absolute right-2 top-2 rounded-[3px] bg-black/70 px-1.5 py-px text-[10.5px] font-semibold text-[#c9d6ea] ring-1 ring-edge-strong">
              01 SEP 2026 · {alert.time}
            </span>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between">
              <span className="tnum rounded-[3px] bg-[#2a0d13]/90 px-1.5 py-px text-[11px] font-bold text-[#ff8b96] ring-1 ring-accent-red/50">
                {alert.subject}
              </span>
              <span className="flex items-center gap-1 text-[10.5px] text-[#8ea1c0]">
                <ZoomIn size={10} /> frame {activeIndex + 1}/{evidence.length} · AI crop 1.0×
              </span>
            </div>
          </div>

          {/* evidence strip */}
          <div className="mt-1.5 flex gap-1.5">
            {evidence.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setFrame(index)}
                title={index === 0 ? 'Primary detection frame' : `Archived frame ${index}`}
                className={`h-[34px] w-[52px] shrink-0 overflow-hidden rounded-[4px] border transition-all ${
                  index === activeIndex
                    ? 'border-accent-cyan/80 shadow-glow'
                    : 'border-edge opacity-70 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <span className="flex flex-1 items-center justify-end gap-1.5 text-[10.5px] text-[#55668a]">
              <ScanSearch size={10} /> clip 00:38 · h.265 · 1080p
            </span>
          </div>

          {/* detection telemetry */}
          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Detection Telemetry</h3>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-edge bg-[#0c1424] px-3 py-2.5">
              <Field label="Detected Object / Plate" value={alert.subject} mono />
              <Field label="Alert Type" value={alert.title} />
              <Field label="Camera ID" value={alert.camera} mono />
              <Field
                label="Location"
                value={`${alert.location}, ${alert.city}`}
              />
              <Field label="Timestamp" value={`${alert.time} · ${alert.ago}`} mono />
              <Field label="Zone / Beat" value={alert.zone} />
              <Field label="First Seen" value={alert.firstSeen ?? '—'} mono />
              <Field label="Last Seen" value={alert.lastSeen ?? '—'} mono />
              {alert.objectLabel ? <Field label="Vehicle / Object" value={alert.objectLabel} /> : null}
              {alert.speedKph ? (
                <Field label="Speed vs Limit" value={`${alert.speedKph} km/h / ${alert.limitKph} km/h`} mono />
              ) : null}
              {alert.heading ? <Field label="Heading / Lane" value={alert.heading} /> : null}
              {alert.watchlistList ? <Field label="Watchlist" value={alert.watchlistList} /> : null}
              <Field label="Assigned To" value={alert.assignedTo ?? 'Unassigned'} />
              <Field label="Case Ref" value={alert.caseRef ?? '—'} mono />
              <div className="col-span-2 flex items-center justify-between gap-3 border-t border-edge-soft pt-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6d7f9e]">
                  Model Confidence
                </span>
                <ConfidenceBar value={alert.confidence} barClass={severityBar[alert.severity]} />
              </div>
            </div>
          </section>

          {/* description */}
          <section className="mt-3">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">Event Description</h3>
            <p className="mt-1.5 rounded-md border border-edge bg-[#0c1424] px-3 py-2 text-[12px] leading-[15px] text-[#b9c7dd]">
              {alert.details}
            </p>
            <p className="mt-1.5 rounded-md border border-edge-soft bg-[#0d1626] px-3 py-2 text-[11.5px] leading-[14.5px] text-[#8ea1c0]">
              <span className="font-bold uppercase tracking-wide text-[#67e8f9]">Ops note · </span>
              {alert.notes}
            </p>
          </section>

          {/* related cameras */}
          <section className="mt-3">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
              <Eye size={10} className="text-accent-cyan" />
              Related Cameras
              <span className="tnum rounded-full bg-[#16233a] px-1.5 text-[10.5px] text-[#8ea1c0]">
                {alert.relatedCameras.length + 1}
              </span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="tnum cursor-default rounded-[4px] border border-accent-cyan/50 bg-[#083344]/60 px-2 py-[3px] text-[11.5px] font-semibold text-[#67e8f9]">
                {alert.camera} · primary
              </span>
              {alert.relatedCameras.map((code) => (
                <button
                  key={code}
                  type="button"
                  title={`Open ${code} on Live View`}
                  onClick={() => onAction(alert, 'camera', code)}
                  className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-2 py-[3px] text-[11.5px] font-semibold text-[#9fc7ff] transition-colors hover:border-accent-blue/60 hover:text-white"
                >
                  {code}
                </button>
              ))}
            </div>
          </section>

          {/* vehicle journey */}
          <section className="mt-3">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
              <Route size={10} className="text-accent-blue" />
              Vehicle Journey
              {alert.journey.length ? (
                <span className="tnum rounded-full bg-[#16233a] px-1.5 text-[10.5px] text-[#8ea1c0]">
                  {alert.journey.length} sightings
                </span>
              ) : null}
            </h3>
            {alert.journey.length ? (
              <>
                <div className="mt-1.5 flex items-stretch gap-0 overflow-x-auto pb-1">
                  {alert.journey.map((stop, index) => (
                    <div key={stop.step} className="flex min-w-0 shrink-0 items-stretch">
                      <div
                        className={`w-[118px] rounded-[5px] border bg-[#0c1424] px-2 py-1.5 ${
                          stop.alert ? 'border-accent-red/60 shadow-[0_0_14px_-6px_rgba(239,68,68,0.8)]' : 'border-edge'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="tnum text-[10px] text-[#8ea1c0]">{stop.time}</span>
                          <span
                            className={`tnum text-[10px] font-bold ${stop.alert ? 'text-[#ff8b96]' : 'text-[#6fe0b0]'}`}
                          >
                            {stop.speedKph} km/h
                          </span>
                        </div>
                        <div className="text-[13px] font-bold leading-tight text-white">{stop.camera}</div>
                        <div className="truncate text-[10.5px] text-[#94a5c2]">
                          {stop.road} · {stop.city}
                        </div>
                        <div className="relative mt-1 h-[34px] overflow-hidden rounded-[3px] border border-edge-soft bg-black">
                          <img src={stop.thumbnail} alt="" className="h-full w-full object-cover" />
                          {stop.alert ? (
                            <span className="absolute inset-0 bg-accent-red/15 ring-1 ring-inset ring-accent-red/50" />
                          ) : null}
                        </div>
                        <div className="mt-1 text-[9.5px] uppercase tracking-wide text-[#55668a]">
                          step {stop.step} · hdg {stop.heading}
                        </div>
                      </div>
                      {index < alert.journey.length - 1 ? (
                        <div className="flex w-6 shrink-0 items-center justify-center">
                          <span className="h-px w-full border-t border-dashed border-accent-cyan/50" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/camera-map')}
                  className="link-action mt-1 flex items-center gap-1 text-[11.5px]"
                >
                  <MapPin size={10} /> Replay full route on Camera Map
                </button>
              </>
            ) : (
              <p className="mt-1.5 rounded-md border border-dashed border-edge px-3 py-2 text-[11.5px] text-ink-dim">
                Non-vehicle event — no ANPR journey available for this incident.
              </p>
            )}
          </section>

          {/* response log */}
          <section className="mt-3 pb-1">
            <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-ink-dim">
              <Flag size={10} className="text-accent-orange" />
              Response Log
            </h3>
            <ol className="mt-1.5 rounded-md border border-edge bg-[#0c1424] px-3 py-2">
              {alert.timeline.map((event, index) => (
                <TimelineRow key={event.id} event={event} isLast={index === alert.timeline.length - 1} />
              ))}
            </ol>
          </section>
        </div>

        {/* action bar */}
        <footer className="grid shrink-0 grid-cols-3 gap-1.5 border-t border-edge px-3.5 py-2.5">
          <button
            type="button"
            disabled={alert.status !== 'new'}
            onClick={() => onAction(alert, 'acknowledge')}
            className={`${btn} border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white hover:brightness-110 disabled:from-[#12213c] disabled:to-[#101b31]`}
          >
            <Check size={11} strokeWidth={2.6} />
            {alert.status === 'new' ? 'Acknowledge' : 'Ack’d'}
          </button>
          <button
            type="button"
            disabled={resolved || alert.status === 'investigating'}
            onClick={() => onAction(alert, 'investigate')}
            className={`${btn} ${ghost}`}
          >
            <ScanSearch size={11} />
            Investigate
          </button>
          <button
            type="button"
            disabled={!alert.plate}
            title={alert.plate ? 'Reconstruct cross-camera journey' : 'No plate on this event'}
            onClick={() => onAction(alert, 'track')}
            className={`${btn} border-accent-cyan/40 bg-[#083344]/50 text-[#67e8f9] hover:border-accent-cyan/70 hover:text-white`}
          >
            <LocateFixed size={11} />
            Track Vehicle
          </button>
          <button type="button" onClick={() => onAction(alert, 'camera')} className={`${btn} ${ghost}`}>
            <Car size={11} />
            View Camera
          </button>
          <button
            type="button"
            disabled={resolved || alert.status === 'escalated'}
            onClick={() => onAction(alert, 'escalate')}
            className={`${btn} border-accent-red/45 bg-accent-red/10 text-[#ff8b96] hover:border-accent-red/70 hover:bg-accent-red/20`}
          >
            <Flag size={11} />
            Escalate
          </button>
          <button
            type="button"
            disabled={resolved}
            onClick={() => onAction(alert, 'resolve')}
            className={`${btn} ${
              resolved
                ? 'border-accent-green/50 bg-accent-green/15 text-[#6fe0b0]'
                : 'border-accent-green/45 bg-[#0b2e26] text-[#6fe0b0] hover:border-accent-green/70 hover:brightness-115'
            }`}
          >
            <ShieldCheck size={11} />
            {resolved ? 'Resolved' : 'Resolve'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
