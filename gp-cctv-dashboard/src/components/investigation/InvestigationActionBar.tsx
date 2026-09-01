import {
  Archive,
  Camera as CameraIcon,
  FileDown,
  FolderPlus,
  Radar,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

import type { InvestigationDossier, InvestigationStatus } from '@/types/investigation';

interface InvestigationActionBarProps {
  dossier: InvestigationDossier;
  status: InvestigationStatus;
  caseRef: string | null;
  evidenceCount: number;
  lastCamera: string;
  onTrackLive: () => void;
  onViewCamera: () => void;
  onAddToWatchlist: () => void;
  onCreateCase: () => void;
  onExportEvidence: () => void;
  onCloseInvestigation: () => void;
  onReopen: () => void;
}

const ghostBtn =
  'flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-2.5 text-[10px] font-semibold text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

/** Sticky action bar for the investigation console. */
export function InvestigationActionBar({
  dossier,
  status,
  caseRef,
  evidenceCount,
  lastCamera,
  onTrackLive,
  onViewCamera,
  onAddToWatchlist,
  onCreateCase,
  onExportEvidence,
  onCloseInvestigation,
  onReopen,
}: InvestigationActionBarProps) {
  const closed = status === 'closed';

  return (
    <div className="sticky bottom-0 z-30 -mx-3 mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-edge bg-[#070c17]/95 px-3 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <span className="tnum rounded-[4px] border border-edge bg-panel px-1.5 py-1 text-[9px] font-semibold text-[#c3cfe2]">
          {dossier.caseId}
        </span>
        <span className="tnum truncate font-mono text-[11px] font-bold tracking-[0.06em] text-white">
          {dossier.target.plate}
        </span>
        <span className="truncate text-[9px] text-[#7f93b3]">
          {dossier.sightings.length} sightings · {evidenceCount} evidence frames · last read {lastCamera}
          {caseRef ? ` · case ${caseRef}` : ' · case not filed'}
        </span>
        <span
          className={`shrink-0 rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.07em] ring-1 ${
            closed
              ? 'bg-[#141b2b] text-[#93a3bd] ring-edge-strong'
              : status === 'escalated'
                ? 'bg-accent-red/20 text-[#ff8b96] ring-accent-red/45'
                : 'bg-accent-green/15 text-[#6fe0b0] ring-accent-green/45'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onTrackLive} disabled={closed} className={`${ghostBtn} border-accent-cyan/45 bg-[#083344]/50 text-[#67e8f9] hover:border-accent-cyan/70 hover:text-white`}>
          <Radar size={12} />
          Track Live
        </button>
        <button type="button" onClick={onViewCamera} className={ghostBtn}>
          <CameraIcon size={12} />
          View Camera
        </button>
        <button
          type="button"
          onClick={onAddToWatchlist}
          className={`${ghostBtn} border-accent-red/45 bg-accent-red/10 text-[#ff8b96] hover:border-accent-red/70 hover:bg-accent-red/20`}
        >
          <ShieldAlert size={12} />
          Add to Watchlist
        </button>
        <button type="button" onClick={onExportEvidence} className={ghostBtn}>
          <FileDown size={12} />
          Export Evidence
        </button>
        <button
          type="button"
          onClick={onCreateCase}
          className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3 text-[10px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <FolderPlus size={12} strokeWidth={2.4} />
          {caseRef ? 'Update Case' : 'Create Case'}
        </button>
        {closed ? (
          <button type="button" onClick={onReopen} className={ghostBtn}>
            <RotateCcw size={12} />
            Reopen
          </button>
        ) : (
          <button type="button" onClick={onCloseInvestigation} className={ghostBtn}>
            <Archive size={12} />
            Close Investigation
          </button>
        )}
      </div>
    </div>
  );
}
