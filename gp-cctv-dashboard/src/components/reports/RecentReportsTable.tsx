import { Check, Download, Eye, Loader2, Search, Share2 } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { StatusChip } from '@/components/reports/reportTones';
import { formatSize, reportTypeById } from '@/data/reportsData';
import type { ReportRecord } from '@/types/reports';

export type DownloadState = 'idle' | 'busy' | 'done';

interface RecentReportsTableProps {
  reports: ReportRecord[];
  selectedId: string | null;
  query: string;
  downloadStates: Record<string, DownloadState>;
  onQuery: (value: string) => void;
  onSelect: (report: ReportRecord) => void;
  onView: (report: ReportRecord) => void;
  onDownload: (report: ReportRecord) => void;
  onShare: (report: ReportRecord) => void;
}

const th =
  'sticky top-0 z-10 whitespace-nowrap border-b border-edge bg-panel-head px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-[0.09em] text-[#8ea1c0]';

function TypeChip({ report }: { report: ReportRecord }) {
  const type = reportTypeById(report.type);
  const Icon = type.icon;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] border px-1.5 py-[2px] text-2xs font-semibold"
      style={{ borderColor: `${type.color}40`, backgroundColor: `${type.color}12`, color: type.color }}
    >
      <Icon size={11} strokeWidth={2.2} className="shrink-0" />
      <span className="truncate">{type.short}</span>
    </span>
  );
}

function RowActions({
  report,
  state,
  onView,
  onDownload,
  onShare,
}: {
  report: ReportRecord;
  state: DownloadState;
  onView: (report: ReportRecord) => void;
  onDownload: (report: ReportRecord) => void;
  onShare: (report: ReportRecord) => void;
}) {
  const ready = report.status === 'completed';
  const iconBtn =
    'grid h-[26px] w-[26px] place-items-center rounded-[4px] text-[#8ea3c4] transition-colors hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        title="Open full report preview"
        onClick={(event) => {
          event.stopPropagation();
          onView(report);
        }}
        className={`${iconBtn} hover:text-accent-cyan`}
      >
        <Eye size={14} />
      </button>
      <button
        type="button"
        title={ready ? `Download ${report.format} (${formatSize(report.sizeMb)})` : 'Available after rendering completes'}
        disabled={!ready || state === 'busy'}
        onClick={(event) => {
          event.stopPropagation();
          onDownload(report);
        }}
        className={`${iconBtn} ${state === 'done' ? 'text-[#6fe0b0]' : 'hover:text-[#9fc7ff]'}`}
      >
        {state === 'busy' ? (
          <Loader2 size={14} className="animate-spin text-accent-cyan" />
        ) : state === 'done' ? (
          <Check size={14} strokeWidth={2.6} />
        ) : (
          <Download size={14} />
        )}
      </button>
      <button
        type="button"
        title={ready ? 'Copy a secure share link (72 h expiry)' : 'Available after rendering completes'}
        disabled={!ready}
        onClick={(event) => {
          event.stopPropagation();
          onShare(report);
        }}
        className={`${iconBtn} hover:text-accent-purple`}
      >
        <Share2 size={14} />
      </button>
    </div>
  );
}

/** High-density registry of the most recent intelligence reports. */
export function RecentReportsTable({
  reports,
  selectedId,
  query,
  downloadStates,
  onQuery,
  onSelect,
  onView,
  onDownload,
  onShare,
}: RecentReportsTableProps) {
  return (
    <Panel
      title="Recent Reports"
      tools={
        <>
          <span className="tnum hidden text-2xs font-medium uppercase tracking-[0.1em] text-ink-faint sm:block">
            {reports.length} documents
          </span>
          <label className="relative block">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search ID, name, officer…"
              className="h-[28px] w-[190px] rounded-[4px] border border-edge bg-[#0c1424] pl-7 pr-2 text-[12px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
            />
          </label>
        </>
      }
      bodyClassName="overflow-auto"
      className="min-h-[300px]"
    >
      <table className="w-full min-w-[880px] border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className={th}>Report ID</th>
            <th className={th}>Report Name</th>
            <th className={th}>Type</th>
            <th className={th}>Generated</th>
            <th className={th}>Created By</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Size</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const selected = report.id === selectedId;
            return (
              <tr
                key={report.id}
                onClick={() => onSelect(report)}
                className={`cursor-pointer border-b border-edge-soft transition-colors ${
                  selected ? 'bg-accent-blue/10' : 'hover:bg-panel-hover/60'
                }`}
              >
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className={`tnum font-mono text-[12px] font-semibold ${selected ? 'text-accent-cyan' : 'text-[#9fc7ff]'}`}>
                    {report.id}
                  </span>
                </td>
                <td className="max-w-[280px] px-2.5 py-2">
                  <span className="block truncate font-medium text-ink" title={report.name}>
                    {report.name}
                  </span>
                  <span className="block truncate text-3xs uppercase tracking-[0.08em] text-ink-faint">
                    {report.scope} · {report.cameras.toLocaleString('en-IN')} cams · {report.records.toLocaleString('en-IN')} records
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <TypeChip report={report} />
                </td>
                <td className="tnum whitespace-nowrap px-2.5 py-2 font-mono text-[11.5px] text-[#9fb0cc]">
                  {report.generatedAt}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className="block text-[12.5px] text-[#c3cfe2]">{report.createdBy}</span>
                  <span className="block text-3xs uppercase tracking-[0.08em] text-ink-faint">{report.creatorRank}</span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <StatusChip status={report.status} />
                </td>
                <td className="tnum whitespace-nowrap px-2.5 py-2 text-right font-mono text-[11.5px] text-[#9fb0cc]">
                  {formatSize(report.sizeMb)}
                  {report.pages > 0 ? <span className="text-ink-faint"> · {report.pages}p</span> : null}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <RowActions
                    report={report}
                    state={downloadStates[report.id] ?? 'idle'}
                    onView={onView}
                    onDownload={onDownload}
                    onShare={onShare}
                  />
                </td>
              </tr>
            );
          })}
          {reports.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-[13px] text-ink-faint">
                No reports match the current search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Panel>
  );
}
