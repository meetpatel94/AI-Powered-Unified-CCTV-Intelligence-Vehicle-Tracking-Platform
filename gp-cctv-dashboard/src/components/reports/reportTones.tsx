import type { ReportClassification, ReportStatus } from '@/types/reports';

/* Shared presentation maps + control classes for the Reports workspace. */

const statusMeta: Record<
  ReportStatus,
  { label: string; chip: string; dot: string; pulse?: boolean }
> = {
  completed: {
    label: 'Completed',
    chip: 'text-[#6fe0b0] bg-accent-green/10 ring-accent-green/40',
    dot: 'bg-accent-green',
  },
  generating: {
    label: 'Generating',
    chip: 'text-[#67e8f9] bg-accent-cyan/10 ring-accent-cyan/40',
    dot: 'bg-accent-cyan',
    pulse: true,
  },
  pending: {
    label: 'Pending',
    chip: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40',
    dot: 'bg-accent-orange',
    pulse: true,
  },
  failed: {
    label: 'Failed',
    chip: 'text-[#ff8b96] bg-accent-red/10 ring-accent-red/40',
    dot: 'bg-accent-red',
  },
};

const classificationMeta: Record<ReportClassification, { label: string; cls: string }> = {
  restricted: { label: 'RESTRICTED', cls: 'border-accent-orange/50 text-[#f7b95f]' },
  internal: { label: 'INTERNAL', cls: 'border-accent-blue/50 text-[#7db4ff]' },
  confidential: { label: 'CONFIDENTIAL', cls: 'border-accent-red/55 text-[#ff8b96]' },
};

export function StatusChip({ status }: { status: ReportStatus }) {
  const meta = statusMeta[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-[2px] text-2xs font-semibold uppercase tracking-[0.08em] ring-1 ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse-dot' : ''}`} />
      {meta.label}
    </span>
  );
}

export function ClassificationTag({ level }: { level: ReportClassification }) {
  const meta = classificationMeta[level];
  return (
    <span
      className={`rounded-[3px] border px-1.5 py-[1px] font-mono text-3xs font-semibold tracking-[0.14em] ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

/* ---------------- shared control classes ---------------- */

export const fieldLabel =
  'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8ea1c0]';

export const selectCls =
  'h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[12.5px] text-[#c3cfe2] outline-none transition-colors hover:border-edge-strong focus:border-accent-blue/70';

export const inputCls =
  'h-[32px] w-full rounded-[4px] border border-edge bg-[#0c1424] px-2.5 text-[12.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70';

export const secondaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white';

export const primaryBtn =
  'flex h-[34px] items-center gap-1.5 rounded-[5px] border border-[#2f6fd0] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
