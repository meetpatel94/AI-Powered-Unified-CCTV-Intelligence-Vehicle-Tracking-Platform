import { AlertTriangle, Expand, MapPin } from 'lucide-react';

import { GujaratPoliceEmblem } from '@/components/common/GujaratPoliceEmblem';
import { Panel } from '@/components/common/Panel';
import { ClassificationTag } from '@/components/reports/reportTones';
import { severityChip, severityLabel } from '@/components/alerts/tones';
import type { ReportPreviewDoc } from '@/types/reports';

const statTone: Record<string, string> = {
  default: 'text-white',
  green: 'text-[#6fe0b0]',
  amber: 'text-[#f7b95f]',
  red: 'text-[#ff8b96]',
  cyan: 'text-[#67e8f9]',
};

const sectionTitle =
  'flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-[#8ea1c0]';

/** Miniature corridor map with the reconstructed route. */
export function RouteMiniMap({ doc, height = 132 }: { doc: ReportPreviewDoc; height?: number }) {
  const line = doc.route.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div
      className="relative overflow-hidden rounded-[5px] border border-edge bg-[#081120]"
      style={{ height }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {/* grid */}
        {[20, 40, 60, 80].map((offset) => (
          <g key={offset} stroke="#12203a" strokeWidth="0.35">
            <line x1={offset} y1="0" x2={offset} y2="100" />
            <line x1="0" y1={offset} x2="100" y2={offset} />
          </g>
        ))}
        {/* corridor */}
        <polyline points="0,92 20,84 45,62 70,34 100,10" fill="none" stroke="#16263f" strokeWidth="7" strokeLinecap="round" />
        {/* route */}
        <polyline
          points={line}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 2"
          style={{ filter: 'drop-shadow(0 0 2px rgba(34,211,238,0.8))' }}
        />
        {doc.route.map((point) => (
          <g key={point.cameraCode}>
            {point.alert ? (
              <circle cx={point.x} cy={point.y} r="4.5" fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.6">
                <animate attributeName="r" values="3;6.5" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            ) : null}
            <circle
              cx={point.x}
              cy={point.y}
              r="2.1"
              fill={point.alert ? '#ef4444' : '#22d3ee'}
              stroke="#05070f"
              strokeWidth="0.8"
            />
          </g>
        ))}
      </svg>
      {/* camera labels */}
      {doc.route.map((point) => (
        <span
          key={point.cameraCode}
          className={`tnum absolute -translate-x-1/2 rounded-[3px] border px-1 py-px font-mono text-3xs font-semibold ${
            point.alert
              ? 'border-accent-red/50 bg-accent-red/15 text-[#ff8b96]'
              : 'border-accent-cyan/40 bg-[#081120]/90 text-[#67e8f9]'
          }`}
          style={{ left: `${point.x}%`, top: `calc(${point.y}% + 9px)` }}
        >
          {point.cameraCode}
        </span>
      ))}
      <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-[3px] bg-[#05070f]/70 px-1.5 py-px text-3xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
        <MapPin size={9} className="text-accent-cyan" /> NH-147 corridor · N ↑ Gandhinagar
      </span>
    </div>
  );
}

/**
 * Right-rail REPORT PREVIEW: a rendered page of the sample Gujarat Police
 * vehicle-intelligence document. The production system replaces this with the
 * paginated PDF preview streamed from `GET /reports/:id/preview`.
 */
export function ReportPreviewPanel({
  doc,
  selectedReportId,
  onExpand,
}: {
  doc: ReportPreviewDoc;
  selectedReportId: string | null;
  onExpand: () => void;
}) {
  return (
    <Panel
      title="Report Preview"
      tools={
        <button
          type="button"
          onClick={onExpand}
          title="Open the full-page report viewer"
          className="flex items-center gap-1 rounded-[4px] border border-edge px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-[#9fc7ff] transition-colors hover:border-accent-blue/60 hover:text-white"
        >
          <Expand size={12} />
          Full View
        </button>
      }
      bodyClassName="overflow-y-auto px-3 pb-3"
      className="h-full min-h-0"
    >
      <article className="animate-fade-in rounded-[6px] border border-edge bg-[#0a1120] shadow-panel">
        {/* document letterhead */}
        <header className="border-b border-edge px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <GujaratPoliceEmblem size={30} className="shrink-0" />
              <div className="leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">Gujarat Police</div>
                <div className="text-3xs uppercase tracking-[0.08em] text-ink-faint">
                  Unified AI CCTV Intelligence Platform
                </div>
              </div>
            </div>
            <ClassificationTag level={doc.classification} />
          </div>
          <h3 className="mt-2 text-[14px] font-bold tracking-tight text-white">{doc.title}</h3>
          <p className="mt-0.5 text-[11.5px] text-[#9fb0cc]">{doc.subtitle}</p>
          <p className="tnum mt-1 font-mono text-3xs text-ink-faint">
            {doc.reportId}
            {selectedReportId && selectedReportId !== doc.reportId ? ` · previewing template for ${selectedReportId}` : ''}
            {' · '}
            {doc.generatedAt}
          </p>
        </header>

        <div className="space-y-3 px-3 py-3">
          {/* selected vehicle */}
          <section>
            <h4 className={sectionTitle}>Selected Vehicle</h4>
            <div className="mt-1.5 flex gap-2.5 rounded-[5px] border border-edge bg-panel-alt/50 p-2">
              <img
                src={doc.vehicle.snapshot}
                alt={doc.vehicle.plate}
                className="h-[54px] w-[76px] shrink-0 rounded-[4px] border border-edge object-cover"
              />
              <div className="min-w-0 leading-snug">
                <div className="flex items-center gap-1.5">
                  <span className="tnum rounded-[3px] border border-accent-cyan/45 bg-accent-cyan/10 px-1.5 py-px font-mono text-[11.5px] font-bold tracking-[0.08em] text-[#8ff0ff]">
                    {doc.vehicle.plate}
                  </span>
                  <span className="tnum text-3xs font-semibold text-[#6fe0b0]">{doc.vehicle.confidence}% OCR</span>
                </div>
                <p className="mt-1 truncate text-[11.5px] text-[#c3cfe2]">{doc.vehicle.description}</p>
                <p className="truncate text-3xs text-ink-faint">Owner: {doc.vehicle.owner}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-3xs font-semibold text-[#ff8b96]">
                  <AlertTriangle size={9} className="shrink-0" />
                  {doc.vehicle.watchlist}
                </p>
              </div>
            </div>
          </section>

          {/* camera journey */}
          <section>
            <h4 className={sectionTitle}>Camera Journey</h4>
            <ol className="mt-1.5 space-y-0">
              {doc.journey.map((leg, index) => (
                <li key={leg.step} className="relative flex gap-2 pl-4">
                  {index < doc.journey.length - 1 ? (
                    <span className="absolute left-[5px] top-[14px] h-full w-px bg-edge" />
                  ) : null}
                  <span
                    className={`absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-[#0a1120] ${
                      leg.alert ? 'bg-accent-red shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-accent-cyan'
                    }`}
                  />
                  <div className="min-w-0 flex-1 pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="tnum font-mono text-[11px] font-semibold text-[#9fc7ff]">
                        {leg.time} · {leg.cameraCode}
                      </span>
                      <span className="tnum shrink-0 font-mono text-3xs text-ink-faint">
                        {leg.speed} · {leg.confidence}%
                      </span>
                    </div>
                    <p className={`truncate text-[11.5px] ${leg.alert ? 'font-semibold text-[#ff8b96]' : 'text-[#c3cfe2]'}`}>
                      {leg.road}, {leg.city}
                      {leg.alert ? ' — WATCHLIST MATCH' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* alert summary */}
          <section>
            <h4 className={sectionTitle}>Alert Summary</h4>
            <ul className="mt-1.5 space-y-1">
              {doc.alertSummary.map((alert) => (
                <li key={alert.label} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11.5px] text-[#c3cfe2]">{alert.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="tnum font-mono text-[11px] font-bold text-white">×{alert.count}</span>
                    <span className={`rounded-[3px] px-1.5 py-px text-3xs font-semibold uppercase ring-1 ${severityChip[alert.severity]}`}>
                      {severityLabel[alert.severity]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* key statistics */}
          <section>
            <h4 className={sectionTitle}>Key Statistics</h4>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {doc.stats.map((stat) => (
                <div key={stat.label} className="rounded-[4px] border border-edge bg-panel-alt/50 px-2 py-1.5">
                  <div className={`tnum text-[14px] font-bold leading-tight ${statTone[stat.tone ?? 'default']}`}>
                    {stat.value}
                  </div>
                  <div className="mt-0.5 truncate text-3xs uppercase tracking-[0.05em] text-ink-faint" title={stat.label}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* evidence */}
          <section>
            <h4 className={sectionTitle}>Evidence Frames</h4>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {doc.evidence.map((frame) => (
                <figure
                  key={frame.id}
                  className={`group relative overflow-hidden rounded-[4px] border ${
                    frame.flagged ? 'border-accent-red/55' : 'border-edge'
                  }`}
                >
                  <img
                    src={frame.thumbnail}
                    alt={frame.caption}
                    className="h-[58px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#05070f]/95 to-transparent px-1.5 pb-1 pt-3">
                    <span className="tnum block truncate font-mono text-3xs font-semibold text-[#c3cfe2]">
                      {frame.cameraCode} · {frame.time}
                    </span>
                  </figcaption>
                  {frame.flagged ? (
                    <span className="absolute right-1 top-1 rounded-[3px] bg-accent-red px-1 py-px text-3xs font-bold text-white shadow-glow-red">
                      MATCH
                    </span>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>

          {/* map route */}
          <section>
            <h4 className={sectionTitle}>Route Reconstruction</h4>
            <div className="mt-1.5">
              <RouteMiniMap doc={doc} />
            </div>
          </section>

          {/* findings */}
          <section>
            <h4 className={sectionTitle}>Findings &amp; Recommendations</h4>
            <ol className="mt-1.5 space-y-1.5">
              {doc.findings.map((finding, index) => (
                <li key={finding.id} className="flex gap-2 text-[11.5px] leading-snug text-[#c3cfe2]">
                  <span className={`mt-px shrink-0 rounded-[3px] px-1 py-px font-mono text-3xs font-bold ring-1 ${severityChip[finding.severity]}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{finding.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-edge px-3 py-2 text-3xs text-ink-faint">
          <span>Generated by {doc.generatedBy}</span>
          <span className="tnum font-mono">Page 1 / 18</span>
        </footer>
      </article>
    </Panel>
  );
}
