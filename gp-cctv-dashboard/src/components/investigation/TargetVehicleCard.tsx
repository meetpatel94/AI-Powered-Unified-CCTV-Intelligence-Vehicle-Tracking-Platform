import {
  Camera as CameraIcon,
  Crosshair,
  Fingerprint,
  IdCard,
  LocateFixed,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { agoOf, computeRouteAnalysis } from '@/data/investigationData';
import type { InvestigationDossier } from '@/types/investigation';

interface TargetVehicleCardProps {
  dossier: InvestigationDossier;
  onOpenEvidence: (sightingId: string) => void;
  onViewCamera: (cameraId: string) => void;
  onOpenWatchlist: () => void;
}

function Metric({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'green' | 'red' | 'cyan';
}) {
  const valueTone =
    tone === 'red' ? 'text-[#ff8b96]' : tone === 'green' ? 'text-[#6fe0b0]' : tone === 'cyan' ? 'text-[#67e8f9]' : 'text-white';
  return (
    <div className="min-w-0 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">{label}</div>
      <div className={`tnum mt-[2px] truncate text-[13px] font-bold leading-tight ${valueTone}`}>{value}</div>
      {sub ? <div className="truncate text-[10px] text-[#7f93b3]">{sub}</div> : null}
    </div>
  );
}

function Attribute({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  const tone = confidence >= 96 ? 'bg-accent-green' : confidence >= 90 ? 'bg-accent-cyan' : 'bg-accent-orange';
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[74px] shrink-0 truncate text-[10.5px] uppercase tracking-[0.06em] text-[#6d7f9e]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#dbe6f5]">{value}</span>
      <span className="h-[3px] w-[26px] shrink-0 overflow-hidden rounded-full bg-[#14243c]">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${confidence}%` }} />
      </span>
      <span className="tnum w-[26px] shrink-0 text-right text-[10px] text-[#7f93b3]">{confidence}%</span>
    </div>
  );
}

/**
 * Prominent TARGET VEHICLE intelligence card: snapshot, identity, watchlist
 * state, confidence and the first/last-seen telemetry for the investigation.
 */
export function TargetVehicleCard({ dossier, onOpenEvidence, onViewCamera, onOpenWatchlist }: TargetVehicleCardProps) {
  const { target, sightings } = dossier;
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const analysis = computeRouteAnalysis(sorted);
  const watchlist = target.watchlist;

  return (
    <Panel
      title="Target Vehicle"
      tools={
        <div className="flex items-center gap-1.5">
          <span className="tnum rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[10.5px] text-[#8ea3c4]">
            {target.id}
          </span>
          <span
            className={`flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.07em] ${
              watchlist.match
                ? 'border-accent-red/60 bg-[#2b0b10] text-[#ff8b96] shadow-[0_0_14px_-6px_rgba(239,68,68,0.9)]'
                : 'border-accent-green/50 bg-[#0b2e26] text-[#6fe0b0]'
            }`}
          >
            {watchlist.match ? <ShieldAlert size={10} className="animate-pulse-dot" /> : <ShieldCheck size={10} />}
            {watchlist.match ? 'Watchlist Match' : 'No Watchlist Match'}
          </span>
        </div>
      }
      className="shrink-0"
      bodyClassName="px-3 pb-2.5 pt-1"
    >
      <div className="flex items-stretch gap-3">
        {/* snapshot */}
        <button
          type="button"
          onClick={() => onOpenEvidence(last.id)}
          title="Open the latest evidence frame"
          className="group relative h-[128px] w-[212px] shrink-0 overflow-hidden rounded-[6px] border border-edge bg-[#0c1424] text-left"
        >
          <img src={target.snapshot} alt={`${target.plate} snapshot`} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 animate-sweep bg-gradient-to-b from-accent-cyan/10 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#05070f]/95 to-transparent" />

          {/* AI detection box */}
          <span className="pointer-events-none absolute left-[14%] top-[26%] h-[52%] w-[64%] border border-accent-cyan/80 shadow-[0_0_14px_-4px_rgba(34,211,238,0.9)]">
            <span className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-accent-cyan" />
            <span className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2 border-accent-cyan" />
            <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-accent-cyan" />
            <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-accent-cyan" />
          </span>

          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-[3px] bg-black/75 px-1.5 py-px text-[10px] font-bold text-[#9fb0cc] ring-1 ring-edge-strong">
            <span className={`h-1.5 w-1.5 rounded-full ${watchlist.match ? 'bg-accent-red animate-pulse-dot' : 'bg-accent-green'}`} />
            {watchlist.match ? 'WATCHLIST MATCH' : 'TARGET LOCK'}
          </span>
          <span className="tnum absolute right-1.5 top-1.5 rounded-[3px] bg-black/75 px-1.5 py-px text-[10px] font-semibold text-[#c9d6ea] ring-1 ring-edge-strong">
            {last.cameraId} · {last.time}
          </span>
          <span className="absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between gap-1">
            <span className="tnum rounded-[3px] bg-[#2a0d13]/90 px-1.5 py-px font-mono text-[12px] font-bold tracking-[0.08em] text-white ring-1 ring-accent-red/50">
              {target.plate}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#8ea1c0] opacity-0 transition-opacity group-hover:opacity-100">
              <ScanSearch size={9} /> open evidence
            </span>
          </span>
        </button>

        {/* identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="tnum font-mono text-[22px] font-bold leading-none tracking-[0.14em] text-white">
                  {target.plate}
                </span>
                <span className="rounded-[4px] border border-edge-strong bg-[#16233a] px-1.5 py-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#c3cfe2]">
                  {target.color}
                </span>
                <span className="rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9fb0cc]">
                  {target.vehicleClass}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#dbe6f5]">
                <IdCard size={11} className="shrink-0 text-accent-cyan" />
                {target.label}
                <span className="text-[11.5px] font-normal text-[#7f93b3]">
                  · {target.make} {target.model} {target.variant} · {target.year} · {target.fuel}
                </span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onViewCamera(last.cameraId)}
                className="flex h-[26px] items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[11.5px] font-semibold text-[#c3cfe2] transition-colors hover:border-accent-blue/60 hover:text-white"
              >
                <CameraIcon size={11} />
                {last.cameraId}
              </button>
              <button
                type="button"
                onClick={onOpenWatchlist}
                className="flex h-[26px] items-center gap-1 rounded-[4px] border border-accent-red/45 bg-accent-red/10 px-2 text-[11.5px] font-semibold text-[#ff8b96] transition-colors hover:border-accent-red/70 hover:bg-accent-red/20"
              >
                <ShieldAlert size={11} />
                {watchlist.entryId}
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-[3px] rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <Fingerprint size={10} className="shrink-0 text-[#6d7f9e]" />
              <span className="truncate text-[10.5px] uppercase tracking-[0.06em] text-[#6d7f9e]">Owner</span>
              <span className="truncate text-[11.5px] font-medium text-[#dbe6f5]">{target.registeredOwner}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[10.5px] uppercase tracking-[0.06em] text-[#6d7f9e]">Registration</span>
              <span className="truncate text-[11.5px] font-medium text-[#dbe6f5]">{target.registrationState}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[10.5px] uppercase tracking-[0.06em] text-[#6d7f9e]">Insurance</span>
              <span className="truncate text-[11.5px] font-medium text-[#f7b95f]">{target.insuranceExpiry}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[10.5px] uppercase tracking-[0.06em] text-[#6d7f9e]">Fitness</span>
              <span className="truncate text-[11.5px] font-medium text-[#dbe6f5]">{target.fitnessExpiry}</span>
            </div>
            <div className="col-span-2 mt-px space-y-[3px] border-t border-edge-soft pt-1.5">
              {target.attributes.map((attribute) => (
                <Attribute key={attribute.label} {...attribute} />
              ))}
            </div>
          </div>
        </div>

        <span className="h-[128px] w-px shrink-0 bg-edge" />

        {/* telemetry */}
        <div className="w-[228px] shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="First Seen" value={first.time} sub={`${first.cameraId} · ${first.location}`} />
            <Metric label="Last Seen" value={last.time} sub={`${last.cameraId} · ${last.location}`} tone="cyan" />
            <Metric
              label="Total Sightings"
              value={String(sightings.length)}
              sub={`${analysis.camerasCrossed} cameras · ${analysis.cities.length} cities`}
            />
            <Metric
              label="ANPR Confidence"
              value={`${target.confidence.toFixed(1)}%`}
              sub={`mean ${target.meanConfidence.toFixed(1)}% over ${sightings.length} reads`}
              tone="green"
            />
          </div>

          <div className="mt-1.5 rounded-[5px] border border-edge bg-[#0c1424] px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
                <Crosshair size={10} className="text-accent-cyan" />
                Watchlist status
              </span>
              <span className="tnum text-[10px] text-[#7f93b3]">added {watchlist.addedOn}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded-[3px] bg-accent-red/20 px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#ff8b96] ring-1 ring-accent-red/40">
                {watchlist.category}
              </span>
              <span className="tnum rounded-[3px] bg-[#16233a] px-1.5 py-px text-[10px] text-[#9fb0cc]">{watchlist.entryId}</span>
              <span className="tnum rounded-[3px] bg-[#16233a] px-1.5 py-px text-[10px] uppercase text-[#9fb0cc]">
                {watchlist.priority}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-[12px] text-[#94a5c2]">{watchlist.action}</p>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="flex flex-1 items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-1 text-[10.5px] text-[#94a5c2]">
              <LocateFixed size={10} className="shrink-0 text-accent-green" />
              <span className="truncate">
                {target.status === 'on-road' ? 'On road · ' : 'Held · '}
                {last.location}, {last.city}
              </span>
            </span>
            <span className="tnum flex items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-1 text-[10.5px] text-[#94a5c2]">
              <Timer size={10} className="shrink-0 text-accent-cyan" />
              {agoOf(last.seconds)}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
