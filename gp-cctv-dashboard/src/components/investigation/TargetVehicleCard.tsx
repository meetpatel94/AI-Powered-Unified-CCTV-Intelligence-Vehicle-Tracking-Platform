import {
  Camera as CameraIcon,
  Crosshair,
  IdCard,
  LocateFixed,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserRound,
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

/**
 * One headline telemetry tile. Tiles sit in an `auto-rows-fr` grid so the row
 * height is shared evenly instead of leaving dead space under the card.
 */
function Metric({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: 'default' | 'green' | 'red' | 'cyan' | 'orange';
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
            : 'text-white';
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-[5px] border border-edge bg-[#0c1424] px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`tnum mt-[3px] truncate text-[14px] font-bold leading-tight ${valueTone}`}>{value}</div>
      <div className="truncate text-[10.5px] leading-[13px] text-[#7f93b3]">{sub}</div>
    </div>
  );
}

/**
 * TARGET VEHICLE: the identity block an investigator reads first — snapshot,
 * plate, make/model, owner, then the six telemetry tiles that matter
 * (first/last seen, sightings, ANPR confidence, current location, watchlist).
 */
export function TargetVehicleCard({ dossier, onOpenEvidence, onViewCamera, onOpenWatchlist }: TargetVehicleCardProps) {
  const { target, sightings } = dossier;
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const analysis = computeRouteAnalysis(sorted);
  const watchlist = target.watchlist;
  const confidenceTone = target.confidence >= 96 ? 'green' : target.confidence >= 90 ? 'cyan' : 'orange';

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
      className="h-full min-h-0"
      bodyClassName="px-3 pb-2.5 pt-1"
    >
      <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-3 md:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* snapshot → evidence */}
        <button
          type="button"
          onClick={() => onOpenEvidence(last.id)}
          title="Open the latest evidence frame"
          className="group relative h-[168px] min-w-0 overflow-hidden rounded-[6px] border border-edge bg-[#0c1424] text-left md:h-full"
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
            <span
              className={`h-1.5 w-1.5 rounded-full ${watchlist.match ? 'bg-accent-red animate-pulse-dot' : 'bg-accent-green'}`}
            />
            {watchlist.match ? 'WATCHLIST MATCH' : 'TARGET LOCK'}
          </span>
          <span className="tnum absolute right-1.5 top-1.5 rounded-[3px] bg-black/75 px-1.5 py-px text-[10px] font-semibold text-[#c9d6ea] ring-1 ring-edge-strong">
            {last.cameraId} · {last.time}
          </span>
          <span className="absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-1">
            <span className="tnum rounded-[3px] bg-[#2a0d13]/90 px-1.5 py-px font-mono text-[12px] font-bold tracking-[0.08em] text-white ring-1 ring-accent-red/50">
              {target.plate}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#8ea1c0] opacity-0 transition-opacity group-hover:opacity-100">
              <ScanSearch size={9} /> open evidence
            </span>
          </span>
        </button>

        {/* identity + telemetry */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
            <span className="tnum font-mono text-[24px] font-bold leading-none tracking-[0.14em] text-white">
              {target.plate}
            </span>
            <span className="rounded-[4px] border border-edge-strong bg-[#16233a] px-1.5 py-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#c3cfe2]">
              {target.color}
            </span>
            <span className="rounded-[4px] border border-edge bg-[#0c1424] px-1.5 py-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9fb0cc]">
              {target.vehicleClass}
            </span>
            <button
              type="button"
              onClick={() => onViewCamera(last.cameraId)}
              className="ml-auto flex h-[24px] shrink-0 items-center gap-1 rounded-[4px] border border-edge bg-[#0c1424] px-2 text-[11.5px] font-semibold text-[#c3cfe2] transition-colors hover:border-accent-blue/60 hover:text-white"
            >
              <CameraIcon size={11} />
              {last.cameraId}
            </button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-[2px] text-[12px] text-[#dbe6f5]">
            <span className="flex min-w-0 items-center gap-1.5">
              <IdCard size={11} className="shrink-0 text-accent-cyan" />
              <span className="truncate">
                {target.label}
                {target.make && target.make !== '—'
                  ? ` · ${target.make} ${target.model} ${target.variant}`.trimEnd()
                  : ''}
              </span>
            </span>
            {target.year > 0 ? (
              <span className="tnum shrink-0 text-[11.5px] text-[#7f93b3]">
                {target.year} · {target.fuel}
              </span>
            ) : null}
            <span className="flex min-w-0 items-center gap-1.5">
              <UserRound size={11} className="shrink-0 text-accent-purple" />
              <span className="truncate">
                {target.registeredOwner} · <span className="text-[#7f93b3]">{target.registrationState}</span>
              </span>
            </span>
          </div>

          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
            <Metric
              label="First seen"
              value={first.time}
              sub={`${first.cameraId} · ${first.location}, ${first.city}`}
              icon={<Timer size={9} className="text-[#6d82a3]" />}
            />
            <Metric
              label="Last seen"
              value={last.time}
              sub={`${last.cameraId} · ${last.location}, ${last.city}`}
              icon={<Timer size={9} className="text-accent-cyan" />}
              tone="cyan"
            />
            <Metric
              label="Total sightings"
              value={String(sightings.length)}
              sub={`${analysis.camerasCrossed} cameras · ${analysis.cities.length} cities`}
              icon={<CameraIcon size={9} className="text-[#6d82a3]" />}
            />
            <Metric
              label="ANPR confidence"
              value={`${target.confidence.toFixed(1)}%`}
              sub={`mean ${target.meanConfidence.toFixed(1)}% over ${sightings.length} reads`}
              icon={<Crosshair size={9} className="text-accent-cyan" />}
              tone={confidenceTone as 'green' | 'cyan' | 'orange'}
            />
            <Metric
              label="Current location"
              value={`${last.area}, ${last.city}`}
              sub={`${target.status === 'on-road' ? 'On road' : target.status === 'parked' ? 'Parked / held' : 'Signal lost'} · ${agoOf(last.seconds)}`}
              icon={<LocateFixed size={9} className="text-accent-green" />}
              tone="green"
            />
            <div className="flex min-w-0 flex-col justify-center rounded-[5px] border border-accent-red/40 bg-[#160b12] px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6d7f9e]">
                <ShieldAlert size={9} className="text-accent-red" />
                <span className="truncate">Watchlist status</span>
              </div>
              <div className="mt-[3px] truncate text-[14px] font-bold leading-tight text-[#ff8b96]">
                {watchlist.match ? watchlist.category : 'No watchlist match'}
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] leading-[13px] text-[#7f93b3]">
                <button
                  type="button"
                  onClick={onOpenWatchlist}
                  className="tnum shrink-0 font-semibold text-[#9fc7ff] underline decoration-dotted underline-offset-2 transition-colors hover:text-accent-cyan"
                  title="Open the watchlist entry"
                >
                  {watchlist.entryId}
                </button>
                <span className="truncate uppercase">{watchlist.priority} · added {watchlist.addedOn}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
