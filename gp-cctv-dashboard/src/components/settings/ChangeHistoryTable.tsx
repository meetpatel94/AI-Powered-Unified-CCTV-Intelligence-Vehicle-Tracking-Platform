import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Download,
  FileClock,
  Filter,
  History,
} from 'lucide-react';

import { SEED_HISTORY } from '@/data/settingsData';

import { StateChip } from '@/components/settings/SettingPrimitives';

import type { ChangeHistoryEntry, HistorySource } from '@/types/settings';

interface ChangeHistoryTableProps {
  /** Live entries recorded during this session. */
  recorded: ChangeHistoryEntry[];
  onExport: (rows: ChangeHistoryEntry[]) => void;
}

const sourceFilter: Array<{ value: HistorySource | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'maintenance', label: 'Maintenance' },
];

const statusTone: Record<ChangeHistoryEntry['status'], 'green' | 'cyan' | 'amber'> = {
  Saved: 'cyan',
  Applied: 'green',
  Live: 'amber',
};

/**
 * CONFIGURATION CHANGE HISTORY — bottom-of-page ledger of every setting
 * change with previous/new values, author, timestamp and status.
 */
export function ChangeHistoryTable({ recorded, onExport }: ChangeHistoryTableProps) {
  const [source, setSource] = useState<HistorySource | 'all'>('all');

  const rows = useMemo(() => {
    const all = [...recorded, ...SEED_HISTORY];
    if (source === 'all') return all;
    return all.filter((row) => row.source === source);
  }, [recorded, source]);

  const sourceCounts = useMemo(() => {
    const all = [...recorded, ...SEED_HISTORY];
    return {
      all: all.length,
      saved: all.filter((row) => row.source === 'saved').length,
      applied: all.filter((row) => row.source === 'applied').length,
      maintenance: all.filter((row) => row.source === 'maintenance').length,
    } as const;
  }, [recorded]);

  const count = rows.length;
  const newCount = recorded.length;

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-edge/80 bg-[#0a111f] px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.09em] text-white">
          <span className="grid h-7 w-7 place-items-center rounded-[6px] border border-accent-cyan/35 bg-accent-cyan/10">
            <FileClock size={14} className="text-accent-cyan" />
          </span>
          Configuration Change History
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {newCount > 0 ? (
            <StateChip tone="cyan" pulse>
              {newCount} new this session
            </StateChip>
          ) : null}
          <div className="flex items-center gap-0.5 rounded-[6px] border border-edge bg-[#0a1120] p-0.5">
            {sourceFilter.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSource(option.value)}
                className={`flex h-[24px] items-center gap-1 rounded-[4px] px-2 text-[11px] font-semibold transition-colors ${
                  source === option.value
                    ? 'bg-gradient-to-r from-[#155e9e] to-[#123f7c] text-white ring-1 ring-accent-blue/50'
                    : 'text-ink-dim hover:text-ink'
                }`}
              >
                <Filter size={10} className={option.value === 'all' ? '' : 'hidden'} />
                {option.label}
                <span className="tnum text-[9.5px] opacity-70">{sourceCounts[option.value]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onExport(rows)}
            className="flex h-[30px] items-center gap-1.5 rounded-[5px] border border-edge bg-[#0c1424] px-2.5 text-[12px] font-semibold text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0">
          <thead>
            <tr>
              {['Setting changed', 'Previous value', 'New value', 'Changed by', 'Timestamp', 'Status'].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-edge bg-panel-head px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={`${index % 2 === 1 ? 'bg-[#0a1120]/60' : ''} ${row.source === 'maintenance' ? 'bg-[#231a08]/25' : ''}`}>
                <td className="whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top">
                  <span className="block text-[12px] font-semibold leading-[15px] text-[#dbe5f4]">{row.settingLabel}</span>
                  <span className="tnum mt-0.5 block text-[9.5px] text-ink-faint">{row.id}</span>
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top">
                  <span className="inline-flex max-w-[220px] truncate rounded-[4px] border border-edge bg-[#0e1730] px-1.5 py-[2px] text-[11px] text-[#8b9bb9] line-through decoration-ink-faint/60">
                    {row.previous}
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top">
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowRight size={11} className="text-ink-faint" />
                    <span className="inline-flex max-w-[240px] truncate rounded-[4px] border border-accent-green/40 bg-[#0b2e26] px-1.5 py-[2px] text-[11px] font-semibold text-[#6fe0b0]">
                      {row.next}
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top text-[11.5px] text-[#c3cfe2]">
                  {row.changedBy}
                </td>
                <td className="tnum whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top text-[11px] text-[#8b9bb9]">
                  {row.timestamp}
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-3 py-2.5 align-top">
                  <StateChip tone={statusTone[row.status]} pulse={row.status === 'Live'}>
                    {row.status}
                  </StateChip>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-ink-faint">
                  No change records for this filter yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-edge/70 bg-panel-head px-4 py-2">
        <span className="flex items-center gap-1.5 text-3xs text-ink-faint">
          <History size={11} />
          Ledger entries {count} · oldest first shown bottom-up — full audit trail lives in the Audit Logs module
        </span>
        <span className="text-3xs text-ink-faint">mock changelog · schema matches <span className="font-mono text-[9.5px] text-accent-cyan">GET /api/v1/settings/changelog</span></span>
      </footer>
    </section>
  );
}
