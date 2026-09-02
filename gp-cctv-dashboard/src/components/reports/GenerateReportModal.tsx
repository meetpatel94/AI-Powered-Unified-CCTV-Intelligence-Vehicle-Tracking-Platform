import { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import { fieldLabel, inputCls, primaryBtn, secondaryBtn, selectCls } from '@/components/reports/reportTones';
import {
  cameraOptions,
  defaultGenerateConfig,
  departmentOptions,
  frequencyLabel,
  locationOptions,
  rangeOptions,
  reportTypeById,
  reportTypes,
  severityOptions,
} from '@/data/reportsData';
import type {
  GenerateReportConfig,
  ReportClassification,
  ReportFilters,
  ReportFormat,
  ScheduleFrequency,
} from '@/types/reports';

interface GenerateReportModalProps {
  open: boolean;
  /** 'now' = Generate Report, 'schedule' = Schedule Report. */
  mode: 'now' | 'schedule';
  /** Filters carried in from the builder panel. */
  seed: ReportFilters;
  onClose: () => void;
  onSubmit: (config: GenerateReportConfig) => void;
}

const formats: Array<{ id: ReportFormat; icon: typeof FileText; hint: string }> = [
  { id: 'PDF', icon: FileText, hint: 'Paginated case-grade document' },
  { id: 'CSV', icon: FileSpreadsheet, hint: 'Raw records for analysis' },
  { id: 'XLSX', icon: FileSpreadsheet, hint: 'Workbook with pivot sheets' },
];

const classifications: Array<{ id: ReportClassification; label: string; hint: string }> = [
  { id: 'internal', label: 'Internal', hint: 'Command-wide circulation' },
  { id: 'restricted', label: 'Restricted', hint: 'Named officers only' },
  { id: 'confidential', label: 'Confidential', hint: 'Case officers + command' },
];

const frequencies: ScheduleFrequency[] = ['hourly', 'every-6-hours', 'daily', 'weekly', 'monthly'];

/**
 * Detailed report configuration modal. In production this posts the exact
 * `GenerateReportConfig` payload to `POST /reports/generate` (mode 'now') or
 * `POST /reports/schedules` (mode 'schedule'); here it simulates the queueing
 * handshake before handing the config back to the page.
 */
export function GenerateReportModal({ open, mode, seed, onClose, onSubmit }: GenerateReportModalProps) {
  const [config, setConfig] = useState<GenerateReportConfig>({ ...defaultGenerateConfig, ...seed, mode });
  const [submitting, setSubmitting] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);

  /* Re-seed during render whenever the modal (re)opens with fresh builder filters. */
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      const type = reportTypeById(seed.type);
      setConfig({
        ...defaultGenerateConfig,
        ...seed,
        mode,
        sections: type.sections,
        name: '',
      });
      setSubmitting(false);
    }
  }

  const type = reportTypeById(config.type);

  const suggestedName = useMemo(
    () => `${type.label} — ${config.location} (${config.range})`,
    [type.label, config.location, config.range],
  );

  if (!open) return null;

  const patch = (next: Partial<GenerateReportConfig>) => setConfig((prev) => ({ ...prev, ...next }));

  const toggleSection = (section: string) =>
    patch({
      sections: config.sections.includes(section)
        ? config.sections.filter((item) => item !== section)
        : [...config.sections, section],
    });

  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      onSubmit({ ...config, name: config.name.trim() || suggestedName });
      setSubmitting(false);
    }, 1100);
  };

  const scheduling = config.mode === 'schedule';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close report configuration"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-[780px] max-w-[95vw] flex-col overflow-hidden rounded-lg border border-edge-strong bg-[#0a1120] shadow-[0_0_50px_rgba(0,0,0,0.7)] animate-drawer-in">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border border-accent-cyan/40 bg-accent-cyan/15">
              {scheduling ? (
                <CalendarClock size={17} className="text-accent-cyan" />
              ) : (
                <Sparkles size={17} className="text-accent-cyan" />
              )}
            </span>
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-white">
                {scheduling ? 'Schedule Recurring Report' : 'Configure Intelligence Report'}
              </h2>
              <p className="mt-[1px] text-[11.5px] text-ink-dim">
                {scheduling
                  ? 'Register a recurring job on the report engine · delivered automatically'
                  : `Report engine renders ${type.label} in ~${type.etaSec}s · queued behind 2 jobs`}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-[30px] w-[30px] place-items-center rounded-[5px] border border-edge text-[#8ea3c4] transition-colors hover:border-edge-strong hover:text-white"
          >
            <X size={15} />
          </button>
        </header>

        {/* body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
          {/* mode switch */}
          <div className="flex gap-1.5 rounded-[6px] border border-edge bg-panel-alt/50 p-1">
            {(['now', 'schedule'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => patch({ mode: option })}
                className={`flex-1 rounded-[4px] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  config.mode === option
                    ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.8)]'
                    : 'text-ink-dim hover:text-white'
                }`}
              >
                {option === 'now' ? 'Generate Now' : 'Recurring Schedule'}
              </button>
            ))}
          </div>

          {/* type */}
          <div>
            <span className={fieldLabel}>Report Type</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {reportTypes.map((item) => {
                const Icon = item.icon;
                const active = config.type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.description}
                    onClick={() => patch({ type: item.id, sections: item.sections })}
                    className={`flex items-center gap-1.5 rounded-[5px] border px-2 py-1.5 text-left text-[12px] font-medium transition-colors ${
                      active
                        ? 'bg-panel-hover text-white'
                        : 'border-edge bg-panel-alt/40 text-[#9fb0cc] hover:border-edge-strong'
                    }`}
                    style={active ? { borderColor: `${item.color}66` } : undefined}
                  >
                    <Icon size={13} style={{ color: item.color }} className="shrink-0" />
                    <span className="truncate">{item.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* name */}
          <label className="block">
            <span className={fieldLabel}>Report Name</span>
            <input
              value={config.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder={suggestedName}
              className={inputCls}
            />
          </label>

          {/* scope filters */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <label className="block">
              <span className={fieldLabel}>Date Range</span>
              <select value={config.range} onChange={(e) => patch({ range: e.target.value })} className={selectCls}>
                {rangeOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Location</span>
              <select value={config.location} onChange={(e) => patch({ location: e.target.value })} className={selectCls}>
                {locationOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Camera</span>
              <select value={config.camera} onChange={(e) => patch({ camera: e.target.value })} className={selectCls}>
                {cameraOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Department</span>
              <select
                value={config.department}
                onChange={(e) => patch({ department: e.target.value })}
                className={selectCls}
              >
                {departmentOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Severity</span>
              <select
                value={config.severity}
                onChange={(e) => patch({ severity: e.target.value as ReportFilters['severity'] })}
                className={selectCls}
              >
                {severityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={fieldLabel}>Notify Recipient</span>
              <input
                value={config.notifyRecipient}
                onChange={(event) => patch({ notifyRecipient: event.target.value })}
                className={inputCls}
              />
            </label>
          </div>

          {/* schedule cadence */}
          {scheduling ? (
            <div className="grid grid-cols-2 gap-2.5 rounded-[6px] border border-accent-cyan/25 bg-accent-cyan/[0.04] p-2.5 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className={fieldLabel}>Frequency</span>
                <div className="flex flex-wrap gap-1.5">
                  {frequencies.map((frequency) => (
                    <button
                      key={frequency}
                      type="button"
                      onClick={() => patch({ frequency })}
                      className={`rounded-[4px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                        config.frequency === frequency
                          ? 'border-accent-cyan/60 bg-accent-cyan/15 text-[#8ff0ff]'
                          : 'border-edge bg-panel-alt/40 text-[#9fb0cc] hover:border-edge-strong'
                      }`}
                    >
                      {frequencyLabel[frequency]}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className={fieldLabel}>Run At (IST)</span>
                <input
                  type="time"
                  value={config.runAt}
                  onChange={(event) => patch({ runAt: event.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
          ) : null}

          {/* sections */}
          <div>
            <span className={fieldLabel}>Included Sections</span>
            <div className="flex flex-wrap gap-1.5">
              {type.sections.map((section) => {
                const active = config.sections.includes(section);
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => toggleSection(section)}
                    className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[12px] transition-colors ${
                      active
                        ? 'border-accent-blue/50 bg-accent-blue/10 text-[#9fc7ff]'
                        : 'border-edge bg-panel-alt/40 text-ink-faint hover:border-edge-strong'
                    }`}
                  >
                    <span
                      className={`grid h-[12px] w-[12px] place-items-center rounded-[3px] border ${
                        active ? 'border-accent-blue bg-accent-blue text-white' : 'border-edge-strong'
                      }`}
                    >
                      {active ? <Check size={9} strokeWidth={3.2} /> : null}
                    </span>
                    {section}
                  </button>
                );
              })}
            </div>
          </div>

          {/* output + classification */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <span className={fieldLabel}>Output Format</span>
              <div className="flex gap-1.5">
                {formats.map((format) => {
                  const Icon = format.icon;
                  const active = config.format === format.id;
                  return (
                    <button
                      key={format.id}
                      type="button"
                      title={format.hint}
                      onClick={() => patch({ format: format.id })}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] border px-2 py-2 text-[12px] font-semibold transition-colors ${
                        active
                          ? 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff]'
                          : 'border-edge bg-panel-alt/40 text-[#9fb0cc] hover:border-edge-strong'
                      }`}
                    >
                      <Icon size={13} />
                      {format.id}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className={fieldLabel}>Classification</span>
              <div className="flex gap-1.5">
                {classifications.map((item) => {
                  const active = config.classification === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.hint}
                      onClick={() => patch({ classification: item.id })}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] border px-2 py-2 text-[12px] font-semibold transition-colors ${
                        active
                          ? item.id === 'confidential'
                            ? 'border-accent-red/60 bg-accent-red/10 text-[#ff8b96]'
                            : item.id === 'restricted'
                              ? 'border-accent-orange/60 bg-accent-orange/10 text-[#f7b95f]'
                              : 'border-accent-blue/60 bg-accent-blue/15 text-[#9fc7ff]'
                          : 'border-edge bg-panel-alt/40 text-[#9fb0cc] hover:border-edge-strong'
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-edge px-4 py-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-faint">
            <FileBadge size={13} className="shrink-0" />
            <span className="truncate">
              {config.sections.length} sections · {config.format} ·{' '}
              {scheduling ? `${frequencyLabel[config.frequency]} at ${config.runAt} IST` : `~${type.etaSec}s render`}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className={secondaryBtn}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={submitting || config.sections.length === 0} className={primaryBtn}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {scheduling ? 'Registering…' : 'Queueing…'}
                </>
              ) : (
                <>
                  {scheduling ? <CalendarClock size={14} strokeWidth={2.3} /> : <Sparkles size={14} strokeWidth={2.3} />}
                  {scheduling ? 'Register Schedule' : 'Generate Report'}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
