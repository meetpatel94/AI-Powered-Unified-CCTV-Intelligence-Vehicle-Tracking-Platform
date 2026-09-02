import {
  Activity,
  Camera as CameraIcon,
  Crosshair,
  FileText,
  Flag,
  LocateFixed,
  MapPin,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { agoOf, computeRouteAnalysis } from '@/data/investigationData';
import type { InvestigationDossier, InvestigationStatus } from '@/types/investigation';

interface InvestigationDetailsPanelProps {
  dossier: InvestigationDossier;
  status: InvestigationStatus;
  caseRef: string | null;
  lastSync: string;
  onOpenCamera: (cameraId: string) => void;
  onOpenEvidence: (sightingId: string) => void;
  onEscalate: () => void;
}

const statusTone: Record<InvestigationStatus, { chip: string; dot: string }> = {
  active: { chip: 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]', dot: 'bg-accent-green' },
  monitoring: { chip: 'border-accent-blue/50 bg-[#12233f] text-[#9fc7ff]', dot: 'bg-accent-blue' },
  escalated: { chip: 'border-accent-red/50 bg-[#2b0b10] text-[#ff8b96]', dot: 'bg-accent-red' },
  closed: { chip: 'border-edge-strong bg-[#141b2b] text-[#93a3bd]', dot: 'bg-[#64748b]' },
};

function Row({
  label,
  value,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'cyan' | 'orange';
  icon?: React.ReactNode;
}) {
  const valueTone =
    tone === 'red'
      ? 'text-[#ff8b96]'
      : tone === 'green'
        ? 'text-[#6fe0b0]'
        : tone === 'cyan'
          ? 'text-[#67e8f9]'
          : tone === 'orange'
            ? 'text-[#f7b95f]'
            : 'text-[#dbe6f5]';
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-edge-soft py-[4px] last:border-b-0">
      <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#6d7f9e]">
        {icon}
        {label}
      </span>
      <span className={`tnum min-w-0 truncate text-right text-[12px] font-medium ${valueTone}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mt-2.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#7f93b3] first:mt-0">
      {icon}
      {children}
      <span className="ml-1 h-px flex-1 bg-edge" />
    </div>
  );
}

/**
 * Right-hand INVESTIGATION DETAILS rail: target / watchlist / camera state,
 * detection and confidence telemetry plus the investigation lifecycle.
 */
export function InvestigationDetailsPanel({
  dossier,
  status,
  caseRef,
  lastSync,
  onOpenCamera,
  onOpenEvidence,
  onEscalate,
}: InvestigationDetailsPanelProps) {
  const { target, sightings, events } = dossier;
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const analysis = computeRouteAnalysis(sorted);
  const matching = [...new Set(sorted.map((s) => s.cameraId))];
  const primaryCameras = sorted.filter((s) => s.journeyStep).map((s) => s.cameraId);
  const confidenceTone = target.confidence >= 96 ? 'green' : target.confidence >= 90 ? 'cyan' : 'orange';

  return (
    <Panel
      title="Investigation Details"
      tools={
        <span className="tnum flex items-center gap-1 text-3xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          synced {lastSync}
        </span>
      }
      className="min-h-0"
      bodyClassName="flex min-h-0 flex-col overflow-y-auto px-3 pb-2.5 pt-1"
    >
      {/* status header */}
      <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="tnum truncate font-mono text-[13px] font-bold tracking-[0.06em] text-white">{dossier.caseId}</span>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-[3px] border px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.07em] ${statusTone[status].chip}`}
          >
            <span className={`h-1 w-1 rounded-full ${statusTone[status].dot} animate-pulse-dot`} />
            {status}
          </span>
        </div>
        <p className="mt-[3px] text-[11px] leading-[13px] text-[#94a5c2]">{dossier.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="tnum rounded-[3px] bg-[#16233a] px-1.5 py-px text-[10px] text-[#9fb0cc]">
            priority · {dossier.priority}
          </span>
          <span className="tnum rounded-[3px] bg-[#16233a] px-1.5 py-px text-[10px] text-[#9fb0cc]">
            opened {dossier.openedAt}
          </span>
          {caseRef ? (
            <span className="tnum flex items-center gap-1 rounded-[3px] bg-accent-blue/15 px-1.5 py-px text-[10px] font-semibold text-[#9fc7ff] ring-1 ring-accent-blue/40">
              <FileText size={8} />
              {caseRef}
            </span>
          ) : null}
        </div>
      </div>

      <SectionLabel icon={<Radar size={9} className="text-accent-cyan" />}>Target state</SectionLabel>
      <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
        <Row
          label="Target status"
          value={target.status === 'on-road' ? `On road · ${last.city}` : target.status === 'parked' ? 'Parked / held' : 'Signal lost'}
          tone={target.status === 'on-road' ? 'green' : 'orange'}
          icon={<Activity size={9} className="text-accent-green" />}
        />
        <Row
          label="Watchlist"
          value={target.watchlist.match ? `Match · ${target.watchlist.category}` : 'No match'}
          tone={target.watchlist.match ? 'red' : 'green'}
          icon={<ShieldAlert size={9} className="text-accent-red" />}
        />
        <Row label="Watchlist entry" value={`${target.watchlist.entryId} · added ${target.watchlist.addedOn}`} />
        <Row
          label="ANPR confidence"
          value={`${target.confidence.toFixed(1)}% peak · ${target.meanConfidence.toFixed(1)}% mean`}
          tone={confidenceTone as 'green' | 'cyan' | 'orange'}
          icon={<Crosshair size={9} className="text-accent-cyan" />}
        />
        <div className="flex items-center gap-1.5 py-[3px]">
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#14243c]">
            <span
              className={`block h-full rounded-full transition-all duration-500 ${
                confidenceTone === 'green' ? 'bg-accent-green' : confidenceTone === 'cyan' ? 'bg-accent-cyan' : 'bg-accent-orange'
              }`}
              style={{ width: `${target.confidence}%` }}
            />
          </span>
          <span className="tnum shrink-0 text-[10px] text-[#7f93b3]">
            {sorted.filter((s) => s.confidence >= 95).length}/{sorted.length} reads ≥ 95%
          </span>
        </div>
        <Row label="Detections" value={`${sorted.length} sightings · ${analysis.camerasCrossed} cameras`} />
        <Row label="AI events" value={`${events.length} linked · ${events.filter((e) => !e.acknowledged).length} unacknowledged`} tone="orange" />
      </div>

      <SectionLabel icon={<MapPin size={9} className="text-accent-blue" />}>Position</SectionLabel>
      <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
        <Row label="First location" value={`${first.location}, ${first.city}`} icon={<MapPin size={9} className="text-[#6d82a3]" />} />
        <div className="tnum flex justify-end pb-[4px] text-[10.5px] text-[#6d82a3]">
          {first.cameraId} · {first.time} · {first.lat.toFixed(4)}, {first.lng.toFixed(4)}
        </div>
        <Row label="Last location" value={`${last.location}, ${last.city}`} icon={<LocateFixed size={9} className="text-[#6d82a3]" />} />
        <div className="tnum flex justify-end pb-[4px] text-[10.5px] text-[#6d82a3]">
          {last.cameraId} · {last.time} · {last.lat.toFixed(4)}, {last.lng.toFixed(4)}
        </div>
        <Row
          label="Current location"
          value={`${last.area}, ${last.city}`}
          tone="cyan"
          icon={<Radar size={9} className="text-accent-cyan" />}
        />
        <div className="flex items-center justify-between py-[3px]">
          <span className="flex items-center gap-1 text-[10.5px] text-[#7f93b3]">
            <Timer size={9} className="text-accent-cyan" />
            last ping {agoOf(last.seconds)} · corridor {analysis.corridorLabel}
          </span>
          <button
            type="button"
            onClick={() => onOpenEvidence(last.id)}
            className="link-action text-[10.5px]"
            title="Open the current evidence frame"
          >
            view frame
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {analysis.cities.map((city, index) => (
            <span key={city} className="flex items-center gap-1.5">
              {index > 0 ? <span className="h-px w-4 bg-accent-cyan/50" /> : null}
              <span className="rounded-[3px] border border-edge bg-[#0d1626] px-1.5 py-px text-[10.5px] text-[#c3cfe2]">{city}</span>
            </span>
          ))}
          <span className="tnum ml-auto text-[10px] text-[#6d82a3]">
            {analysis.zones} zones · {analysis.departments.length} depts
          </span>
        </div>
      </div>

      <SectionLabel icon={<CameraIcon size={9} className="text-accent-purple" />}>
        Matching cameras <span className="tnum ml-1 rounded-full bg-[#16233a] px-1.5 text-[10px]">{matching.length}</span>
      </SectionLabel>
      <div className="flex flex-wrap gap-1 py-1">
        {matching.map((code) => {
          const primary = primaryCameras.includes(code);
          const sighting = sorted.find((s) => s.cameraId === code);
          return (
            <button
              key={code}
              type="button"
              title={sighting ? `${sighting.location} · ${sighting.time}` : code}
              onClick={() => onOpenCamera(code)}
              className={`tnum rounded-[4px] border px-1.5 py-[3px] text-[11px] font-semibold transition-colors ${
                primary
                  ? 'border-accent-cyan/60 bg-[#083344]/60 text-[#67e8f9] hover:border-accent-cyan hover:text-white'
                  : 'border-edge bg-[#0c1424] text-[#9fc7ff] hover:border-accent-blue/60 hover:text-white'
              }`}
            >
              {code}
              {primary ? <span className="ml-1 text-[9.5px] opacity-80">route</span> : null}
            </button>
          );
        })}
      </div>

      <SectionLabel icon={<Flag size={9} className="text-accent-orange" />}>Investigation state</SectionLabel>
      <div className="rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
        <Row label="Investigation status" value={status} tone={status === 'closed' ? 'default' : status === 'escalated' ? 'red' : 'green'} />
        <Row label="Assigned unit" value={dossier.unit} />
        <Row label="Investigating officer" value={dossier.openedBy} />
        <Row label="Case reference" value={caseRef ?? 'Not filed yet'} tone={caseRef ? 'cyan' : 'default'} />
        <Row label="Movement" value={`${analysis.compass} ${String(analysis.bearingDeg).padStart(3, '0')}° · ${analysis.avgSpeedKph} km/h avg`} />
        <Row label="Longest gap" value={`${analysis.longestGap.label} · ${Math.floor(analysis.longestGap.seconds / 60)}m ${analysis.longestGap.seconds % 60}s`} tone="orange" />
      </div>

      <button
        type="button"
        onClick={onEscalate}
        disabled={status === 'escalated' || status === 'closed'}
        className="mt-2 flex h-[28px] shrink-0 items-center justify-center gap-1.5 rounded-[5px] border border-accent-orange/45 bg-accent-orange/10 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#f7b95f] transition-colors hover:border-accent-orange/70 hover:bg-accent-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'escalated' ? <ShieldCheck size={11} /> : <TriangleAlert size={11} />}
        {status === 'escalated' ? 'Escalated to control room' : 'Escalate to control room'}
      </button>
    </Panel>
  );
}
