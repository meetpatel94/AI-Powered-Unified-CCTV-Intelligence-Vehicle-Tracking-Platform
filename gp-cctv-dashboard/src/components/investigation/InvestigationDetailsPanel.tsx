import {
  Activity,
  Compass,
  FileText,
  Flag,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { computeRouteAnalysis } from '@/data/investigationData';
import type { InvestigationDossier, InvestigationStatus } from '@/types/investigation';

interface InvestigationDetailsPanelProps {
  dossier: InvestigationDossier;
  status: InvestigationStatus;
  caseRef: string | null;
  lastSync: string;
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
    <div className="flex items-baseline justify-between gap-2 border-b border-edge-soft py-[5px] last:border-b-0">
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
 * INVESTIGATION DETAILS: the case state an officer signs off on — live status,
 * the assigned unit / officer, the case reference and the movement summary.
 * Everything already carried by the target card or the journey panels is left
 * out so the rail stays short enough to sit beside the target vehicle.
 */
export function InvestigationDetailsPanel({
  dossier,
  status,
  caseRef,
  lastSync,
  onEscalate,
}: InvestigationDetailsPanelProps) {
  const { target, sightings } = dossier;
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const analysis = computeRouteAnalysis(sorted);
  const last = sorted[sorted.length - 1];

  return (
    <Panel
      title="Investigation Details"
      tools={
        <span className="tnum flex items-center gap-1 text-3xs text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          synced {lastSync}
        </span>
      }
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-col overflow-y-auto px-3 pb-2.5 pt-1"
    >
      {/* case identity + live status */}
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="tnum truncate font-mono text-[13px] font-bold tracking-[0.06em] text-white">
            {dossier.caseId}
          </span>
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
        </div>
      </div>

      <SectionLabel icon={<Activity size={9} className="text-accent-green" />}>Target state</SectionLabel>
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
        <Row
          label="Target status"
          value={
            target.status === 'on-road'
              ? `On road · ${last.city}`
              : target.status === 'parked'
                ? 'Parked / held'
                : 'Signal lost'
          }
          tone={target.status === 'on-road' ? 'green' : 'orange'}
          icon={<Activity size={9} className="text-accent-green" />}
        />
        <Row
          label="Watchlist"
          value={target.watchlist.match ? `Match · ${target.watchlist.category}` : 'No match'}
          tone={target.watchlist.match ? 'red' : 'green'}
          icon={<ShieldAlert size={9} className="text-accent-red" />}
        />
      </div>

      <SectionLabel icon={<Flag size={9} className="text-accent-orange" />}>Case &amp; movement</SectionLabel>
      <div className="shrink-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1">
        <Row label="Assigned unit" value={dossier.unit} icon={<Radar size={9} className="text-accent-blue" />} />
        <Row
          label="Investigating officer"
          value={dossier.openedBy}
          icon={<UserRound size={9} className="text-accent-purple" />}
        />
        <Row
          label="Case reference"
          value={caseRef ?? 'Not filed yet'}
          tone={caseRef ? 'cyan' : 'default'}
          icon={<FileText size={9} className="text-accent-cyan" />}
        />
        <Row
          label="Direction"
          value={`${analysis.compass} ${String(analysis.bearingDeg).padStart(3, '0')}°`}
          tone="cyan"
          icon={<Compass size={9} className="text-accent-cyan" />}
        />
        <Row label="Corridor" value={analysis.corridorLabel} />
        <Row
          label="Average speed"
          value={`${analysis.avgSpeedKph} km/h · ${analysis.camerasCrossed} cameras`}
          icon={<Timer size={9} className="text-accent-orange" />}
        />
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
