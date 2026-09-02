import { useState } from 'react';
import { AlertTriangle, Check, Download, Loader2, Printer, Share2, X } from 'lucide-react';

import { GujaratPoliceEmblem } from '@/components/common/GujaratPoliceEmblem';
import { RouteMiniMap } from '@/components/reports/ReportPreviewPanel';
import { ClassificationTag, StatusChip, secondaryBtn } from '@/components/reports/reportTones';
import { severityChip, severityLabel } from '@/components/alerts/tones';
import { formatSize, reportTypeById } from '@/data/reportsData';
import type { ReportPreviewDoc, ReportRecord } from '@/types/reports';

interface ReportViewerModalProps {
  open: boolean;
  report: ReportRecord | null;
  doc: ReportPreviewDoc;
  onClose: () => void;
  onDownload: (report: ReportRecord) => void;
  onShare: (report: ReportRecord) => void;
}

const sectionTitle =
  'border-b border-edge-soft pb-1 text-2xs font-bold uppercase tracking-[0.12em] text-[#8ea1c0]';

const statTone: Record<string, string> = {
  default: 'text-white',
  green: 'text-[#6fe0b0]',
  amber: 'text-[#f7b95f]',
  red: 'text-[#ff8b96]',
  cyan: 'text-[#67e8f9]',
};

/**
 * Full-page report viewer: the rendered intelligence document at reading
 * size. In production this hosts the paginated PDF stream; the layout below
 * mirrors the generated document structure 1:1.
 */
export function ReportViewerModal({ open, report, doc, onClose, onDownload, onShare }: ReportViewerModalProps) {
  const [downloading, setDownloading] = useState<'idle' | 'busy' | 'done'>('idle');
  const [seenOpen, setSeenOpen] = useState(false);

  /* Reset the download affordance during render whenever the viewer reopens. */
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setDownloading('idle');
  }

  if (!open || !report) return null;

  const type = reportTypeById(report.type);
  const ready = report.status === 'completed';

  const download = () => {
    if (!ready || downloading === 'busy') return;
    setDownloading('busy');
    window.setTimeout(() => {
      onDownload(report);
      setDownloading('done');
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close report viewer"
        className="absolute inset-0 animate-fade-in bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-[960px] max-w-[96vw] flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-drawer-in">
        {/* viewer chrome */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[7px] border"
              style={{ borderColor: `${type.color}44`, backgroundColor: `${type.color}14`, color: type.color }}
            >
              <type.icon size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold text-white">{report.name}</h2>
              <p className="tnum mt-px truncate font-mono text-3xs text-ink-faint">
                {report.id} · {report.generatedAt} IST · {report.creatorRank} {report.createdBy} ·{' '}
                {formatSize(report.sizeMb)}
                {report.pages > 0 ? ` · ${report.pages} pages` : ''}
              </p>
            </div>
            <StatusChip status={report.status} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="Copy a secure share link (72 h expiry)"
              disabled={!ready}
              onClick={() => onShare(report)}
              className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Share2 size={13} />
              Share
            </button>
            <button
              type="button"
              title="Send to the command printer pool"
              disabled={!ready}
              onClick={() => window.print()}
              className={`${secondaryBtn} hidden disabled:cursor-not-allowed disabled:opacity-40 sm:flex`}
            >
              <Printer size={13} />
              Print
            </button>
            <button
              type="button"
              title={ready ? `Download ${report.format}` : 'Available after rendering completes'}
              disabled={!ready || downloading === 'busy'}
              onClick={download}
              className={`flex h-[34px] items-center gap-1.5 rounded-[5px] border px-3 text-[12.5px] font-semibold transition-all ${
                downloading === 'done'
                  ? 'border-accent-green/60 bg-accent-green/15 text-[#6fe0b0]'
                  : 'border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] hover:brightness-110'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {downloading === 'busy' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : downloading === 'done' ? (
                <Check size={14} strokeWidth={2.6} />
              ) : (
                <Download size={14} />
              )}
              {downloading === 'done' ? 'Saved' : `Download ${report.format}`}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-[30px] w-[30px] place-items-center rounded-[5px] border border-edge text-[#8ea3c4] transition-colors hover:border-edge-strong hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* rendered document */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#070d19] px-4 py-4 sm:px-6">
          <article className="mx-auto max-w-[820px] rounded-[8px] border border-edge bg-[#0a1120] shadow-panel">
            {/* letterhead */}
            <header className="border-b-2 border-edge px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <GujaratPoliceEmblem size={44} className="shrink-0 drop-shadow-[0_0_8px_rgba(47,125,255,0.35)]" />
                  <div className="leading-tight">
                    <div className="text-[15px] font-bold uppercase tracking-[0.1em] text-white">Gujarat Police</div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                      Unified AI CCTV Intelligence Platform · State Command, Gandhinagar
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ClassificationTag level={doc.classification} />
                  <span className="tnum font-mono text-3xs text-ink-faint">{report.id}</span>
                </div>
              </div>
              <h1 className="mt-3.5 text-[19px] font-bold tracking-tight text-white">{doc.title}</h1>
              <p className="mt-0.5 text-[13px] text-[#9fb0cc]">{doc.subtitle}</p>
              <p className="tnum mt-1.5 font-mono text-[11px] text-ink-faint">
                Generated {doc.generatedAt} · {doc.generatedBy}
              </p>
            </header>

            <div className="space-y-5 px-5 py-4">
              {/* vehicle + stats band */}
              <section className="grid gap-3 sm:grid-cols-[280px_1fr]">
                <div>
                  <h4 className={sectionTitle}>1 · Selected Vehicle</h4>
                  <div className="mt-2 overflow-hidden rounded-[6px] border border-edge">
                    <img src={doc.vehicle.snapshot} alt={doc.vehicle.plate} className="h-[128px] w-full object-cover" />
                    <div className="space-y-1 bg-panel-alt/50 p-2.5 leading-snug">
                      <div className="flex items-center justify-between gap-2">
                        <span className="tnum rounded-[3px] border border-accent-cyan/45 bg-accent-cyan/10 px-2 py-0.5 font-mono text-[13px] font-bold tracking-[0.1em] text-[#8ff0ff]">
                          {doc.vehicle.plate}
                        </span>
                        <span className="tnum text-2xs font-semibold text-[#6fe0b0]">{doc.vehicle.confidence}% OCR</span>
                      </div>
                      <p className="text-[12px] text-[#c3cfe2]">{doc.vehicle.description}</p>
                      <p className="text-2xs text-ink-faint">Owner: {doc.vehicle.owner}</p>
                      <p className="flex items-center gap-1 text-2xs font-semibold text-[#ff8b96]">
                        <AlertTriangle size={10} className="shrink-0" />
                        {doc.vehicle.watchlist}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className={sectionTitle}>2 · Key Statistics</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {doc.stats.map((stat) => (
                      <div key={stat.label} className="rounded-[5px] border border-edge bg-panel-alt/50 px-2.5 py-2.5">
                        <div className={`tnum text-[19px] font-bold leading-none ${statTone[stat.tone ?? 'default']}`}>
                          {stat.value}
                        </div>
                        <div className="mt-1.5 text-3xs uppercase tracking-[0.06em] text-ink-faint">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <h4 className={`${sectionTitle} mt-4`}>3 · Alert Summary</h4>
                  <ul className="mt-2 space-y-1.5">
                    {doc.alertSummary.map((alert) => (
                      <li key={alert.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="min-w-0 truncate text-[#c3cfe2]">{alert.label}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="tnum font-mono font-bold text-white">×{alert.count}</span>
                          <span className={`rounded-[3px] px-1.5 py-px text-3xs font-semibold uppercase ring-1 ${severityChip[alert.severity]}`}>
                            {severityLabel[alert.severity]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* journey + route */}
              <section className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h4 className={sectionTitle}>4 · Camera Journey</h4>
                  <ol className="mt-2">
                    {doc.journey.map((leg, index) => (
                      <li key={leg.step} className="relative flex gap-2.5 pl-5">
                        {index < doc.journey.length - 1 ? (
                          <span className="absolute left-[6px] top-[16px] h-full w-px bg-edge" />
                        ) : null}
                        <span
                          className={`absolute left-0 top-[6px] h-[13px] w-[13px] rounded-full border-2 border-[#0a1120] ${
                            leg.alert ? 'bg-accent-red shadow-[0_0_10px_rgba(239,68,68,0.85)]' : 'bg-accent-cyan'
                          }`}
                        />
                        <div className="min-w-0 flex-1 pb-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="tnum font-mono text-[12px] font-semibold text-[#9fc7ff]">
                              {leg.time} · {leg.cameraCode}
                            </span>
                            <span className="tnum shrink-0 font-mono text-2xs text-ink-faint">
                              {leg.speed} · OCR {leg.confidence}%
                            </span>
                          </div>
                          <p className={`text-[12.5px] ${leg.alert ? 'font-semibold text-[#ff8b96]' : 'text-[#c3cfe2]'}`}>
                            {leg.road}, {leg.city}
                            {leg.alert ? ' — WATCHLIST MATCH · INTERCEPT ADVISED' : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4 className={sectionTitle}>5 · Route Reconstruction</h4>
                  <div className="mt-2">
                    <RouteMiniMap doc={doc} height={196} />
                  </div>
                </div>
              </section>

              {/* evidence */}
              <section>
                <h4 className={sectionTitle}>6 · Evidence Appendix</h4>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {doc.evidence.map((frame) => (
                    <figure
                      key={frame.id}
                      className={`group relative overflow-hidden rounded-[5px] border ${
                        frame.flagged ? 'border-accent-red/55' : 'border-edge'
                      }`}
                    >
                      <img
                        src={frame.thumbnail}
                        alt={frame.caption}
                        className="h-[86px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <figcaption className="bg-panel-alt/60 px-2 py-1.5 leading-tight">
                        <span className="tnum block truncate font-mono text-3xs font-semibold text-[#c3cfe2]">
                          {frame.id} · {frame.cameraCode} · {frame.time}
                        </span>
                        <span className="block truncate text-3xs text-ink-faint">{frame.caption}</span>
                      </figcaption>
                      {frame.flagged ? (
                        <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-accent-red px-1.5 py-px text-3xs font-bold text-white shadow-glow-red">
                          MATCH
                        </span>
                      ) : null}
                    </figure>
                  ))}
                </div>
              </section>

              {/* findings */}
              <section>
                <h4 className={sectionTitle}>7 · Findings &amp; Recommendations</h4>
                <ol className="mt-2 space-y-2">
                  {doc.findings.map((finding, index) => (
                    <li key={finding.id} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[#c3cfe2]">
                      <span className={`mt-px h-fit shrink-0 rounded-[3px] px-1.5 py-px font-mono text-3xs font-bold ring-1 ${severityChip[finding.severity]}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{finding.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <footer className="flex items-center justify-between border-t border-edge px-5 py-3 text-2xs text-ink-faint">
              <span>
                Chain of custody sealed · SHA-256 digest recorded · Rendered by GP Report Engine v2.4
              </span>
              <span className="tnum font-mono">Page 1 of {report.pages || 18}</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
