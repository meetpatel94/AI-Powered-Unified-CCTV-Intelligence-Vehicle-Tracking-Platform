import { Settings2, Sparkles } from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import { fieldLabel, primaryBtn, selectCls } from '@/components/reports/reportTones';
import {
  cameraOptions,
  departmentOptions,
  locationOptions,
  rangeOptions,
  reportTypeById,
  reportTypes,
  severityOptions,
} from '@/data/reportsData';
import type { ReportFilters } from '@/types/reports';

interface ReportBuilderPanelProps {
  filters: ReportFilters;
  onChange: (patch: Partial<ReportFilters>) => void;
  onGenerate: () => void;
}

/**
 * Report generation panel: pick the report type, scope it with the query
 * filters and hand off to the configuration modal. The selected filter set is
 * exactly the payload the future `POST /reports/generate` endpoint expects.
 */
export function ReportBuilderPanel({ filters, onChange, onGenerate }: ReportBuilderPanelProps) {
  const activeType = reportTypeById(filters.type);

  return (
    <Panel
      title="Generate New Report"
      tools={
        <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.1em] text-ink-faint">
          <Sparkles size={12} className="text-accent-cyan" />
          report engine · ready
        </span>
      }
      bodyClassName="px-3.5 pb-3.5"
    >
      {/* report type selector */}
      <div>
        <span className={fieldLabel}>Report Type</span>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 2xl:grid-cols-4">
          {reportTypes.map((type) => {
            const Icon = type.icon;
            const active = filters.type === type.id;
            return (
              <button
                key={type.id}
                type="button"
                title={type.description}
                onClick={() => onChange({ type: type.id })}
                className={`flex items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left transition-all ${
                  active
                    ? 'border-transparent bg-panel-hover ring-1'
                    : 'border-edge bg-panel-alt/50 hover:border-edge-strong hover:bg-panel-hover/60'
                }`}
                style={active ? { boxShadow: `0 0 14px -6px ${type.color}`, borderColor: `${type.color}66` } : undefined}
              >
                <span
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[5px] border"
                  style={{ borderColor: `${type.color}44`, backgroundColor: `${type.color}14`, color: type.color }}
                >
                  <Icon size={14} strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[12.5px] font-semibold ${active ? 'text-white' : 'text-[#c3cfe2]'}`}>
                    {type.short}
                  </span>
                  <span className="block truncate text-3xs uppercase tracking-[0.08em] text-ink-faint">
                    ~{type.etaSec}s render
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">{activeType.description}</p>
      </div>

      {/* query filters */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <label className="block">
          <span className={fieldLabel}>Date Range</span>
          <select value={filters.range} onChange={(e) => onChange({ range: e.target.value })} className={selectCls}>
            {rangeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Location</span>
          <select value={filters.location} onChange={(e) => onChange({ location: e.target.value })} className={selectCls}>
            {locationOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Camera</span>
          <select value={filters.camera} onChange={(e) => onChange({ camera: e.target.value })} className={selectCls}>
            {cameraOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Department</span>
          <select
            value={filters.department}
            onChange={(e) => onChange({ department: e.target.value })}
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
            value={filters.severity}
            onChange={(e) => onChange({ severity: e.target.value as ReportFilters['severity'] })}
            className={selectCls}
          >
            {severityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* submit strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-edge-soft pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-faint">
          <Settings2 size={13} className="shrink-0 text-ink-faint" />
          <span className="truncate">
            Sections: <span className="text-[#9fb0cc]">{activeType.sections.join(' · ')}</span>
          </span>
        </span>
        <button type="button" onClick={onGenerate} className={primaryBtn}>
          <Sparkles size={14} strokeWidth={2.3} />
          Generate Report
        </button>
      </div>
    </Panel>
  );
}
