import { Download, Plus, ShieldAlert, SlidersHorizontal, Upload } from 'lucide-react';
import { useRef } from 'react';

interface WatchlistHeaderProps {
  filtersVisible: boolean;
  onToggleFilters: () => void;
  onAdd: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

const secondaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

/** Page title bar with the watchlist action cluster (add / import / export / filters). */
export function WatchlistHeader({
  filtersVisible,
  onToggleFilters,
  onAdd,
  onExport,
  onImportFile,
}: WatchlistHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="page-title flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] border border-accent-purple/40 bg-accent-purple/15 shadow-[0_0_12px_-3px_rgba(168,85,247,0.55)]">
            <ShieldAlert size={18} className="text-accent-purple" />
          </span>
          Watchlist Management
        </h1>
        <p className="page-sub mt-1">
          Centralised registry of vehicles, persons &amp; entities under active surveillance
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          title="Toggle filter bar"
          onClick={onToggleFilters}
          className={`grid h-[34px] w-[34px] place-items-center rounded-[5px] border transition-colors ${
            filtersVisible
              ? 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff]'
              : 'border-edge bg-panel text-[#8ea3c4] hover:border-edge-strong hover:text-white'
          }`}
        >
          <SlidersHorizontal size={15} strokeWidth={2} />
        </button>
        <button type="button" className={secondaryBtn} onClick={() => fileRef.current?.click()}>
          <Upload size={14} strokeWidth={2} />
          Import
        </button>
        <button type="button" className={secondaryBtn} onClick={onExport}>
          <Download size={14} strokeWidth={2} />
          Export
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110"
        >
          <Plus size={15} strokeWidth={2.4} />
          Add to Watchlist
        </button>
      </div>
    </div>
  );
}
