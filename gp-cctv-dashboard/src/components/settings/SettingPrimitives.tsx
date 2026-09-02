import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  type LucideIcon,
} from 'lucide-react';

import type { NumericMeta } from '@/types/settings';

/* ------------------------------------------------------------------ *
 * Shared control primitives for the SYSTEM CONTROL CENTER workspace.
 * Every control is compact-but-readable (never microscopic), uses the
 * console palette (dark navy panels, thin blue-gray borders, cyan/blue
 * primary accents) and is fully keyboard-accessible.
 * ------------------------------------------------------------------ */

const focusRing =
  'outline-none focus:border-accent-blue/70 focus:shadow-[0_0_0_3px_rgba(47,125,255,0.13)]';

/* ------------------------------------------------------------------ *
 * Section panel shell — identity tile + title + blurb + header actions
 * ------------------------------------------------------------------ */

interface SectionPanelProps {
  id?: string;
  icon: LucideIcon;
  iconTileCls: string;
  iconCls: string;
  title: string;
  blurb: string;
  pendingChanges?: number;
  headerNote?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function SectionPanel({
  id,
  icon: Icon,
  iconTileCls,
  iconCls,
  title,
  blurb,
  pendingChanges = 0,
  headerNote,
  actions,
  footer,
  children,
}: SectionPanelProps) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="panel overflow-hidden">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-edge/80 bg-[#0a111f] px-4 py-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border ${iconTileCls}`}
          >
            <Icon size={17} strokeWidth={1.9} className={iconCls} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13.5px] font-semibold uppercase tracking-[0.09em] text-white">
                {title}
              </h2>
              {pendingChanges > 0 ? (
                <span className="flex items-center gap-1 rounded-[3px] border border-accent-orange/45 bg-[#2b1a06] px-1.5 py-px text-3xs font-bold uppercase tracking-wider text-[#f7b95f]">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-orange animate-pulse-dot" />
                  {pendingChanges} pending
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] leading-[15px] text-ink-dim">{blurb}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerNote}
            {actions}
          </div>
        </header>
        <div className="px-4 py-2">{children}</div>
        {footer ? (
          <div className="border-t border-edge/60 bg-[#0a111f] px-4 py-2">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Sub-section heading (uppercase micro label over a row group)
 * ------------------------------------------------------------------ */

export function SectionSubhead({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3 border-b border-edge/50 pb-1.5 pt-3 first:border-b-0 first:pt-1">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6d80a3]">
        {children}
      </span>
      {right ? <span className="text-[11px] text-ink-faint">{right}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Setting row — label + description left, control right.
 * Stacks into two columns on wide panels, wraps gracefully on narrow.
 * ------------------------------------------------------------------ */

interface SettingRowProps {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Extra classes for the control cell (e.g. max width). */
  controlCls?: string;
  /** Marks a mandatory setting. */
  required?: boolean;
  /** Inline validation message (red border + text). */
  error?: string | null;
}

export function SettingRow({ label, hint, children, controlCls = '', required, error }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-edge/40 py-3 last:border-b-0 xl:flex-row xl:items-start xl:justify-between xl:gap-8">
      <div className="min-w-0 max-w-[560px] flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium leading-[17px] text-[#d7e1f1]">{label}</span>
          {required ? (
            <span className="text-[11px] font-bold text-accent-red" title="Required">
              *
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-0.5 text-[11.5px] leading-[15px] text-ink-faint">{hint}</p> : null}
        {error ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#ff8b96]">
            <CircleAlert size={11} className="shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
      <div className={`flex min-w-0 items-center ${controlCls || 'xl:w-[min(420px,46%)]'} xl:shrink-0 xl:justify-end`}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Toggle switch
 * ------------------------------------------------------------------ */

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Renders "On/Off" caption next to the knob. */
  caption?: boolean;
}

export function SettingToggle({ checked, onChange, label, disabled, caption }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className={`relative h-[20px] w-[38px] shrink-0 rounded-full border transition-all duration-200 ${
          checked
            ? 'border-accent-cyan/70 bg-gradient-to-r from-[#0e7490] to-[#155e9e] shadow-[0_0_10px_-2px_rgba(34,211,238,0.7)]'
            : 'border-edge-strong bg-[#0e1730] group-hover:border-[#33507e]'
        }`}
      >
        <span
          className={`absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition-all duration-200 ${
            checked ? 'left-[21px] bg-[#a5f3fc]' : 'left-[2.5px] bg-[#5a6d90]'
          }`}
        />
      </span>
      {caption ? (
        <span
          className={`tnum text-[11px] font-semibold uppercase tracking-wider ${
            checked ? 'text-[#67e8f9]' : 'text-ink-faint'
          }`}
        >
          {checked ? 'On' : 'Off'}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Text input
 * ------------------------------------------------------------------ */

interface SettingTextProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string | null;
  maxLength?: number;
  width?: string;
}

export function SettingTextInput({ value, onChange, placeholder, error, maxLength, width }: SettingTextProps) {
  return (
    <div className={`${width ?? 'w-full xl:w-[300px]'}`}>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={`h-[34px] w-full rounded-[5px] border bg-[#0c1424] px-2.5 text-[13px] text-ink placeholder:text-ink-faint transition-all ${focusRing} ${
          error ? 'border-accent-red/70 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-edge'
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Number input with bounds from the numeric registry. Local string
 * buffer keeps typing fluid; out-of-range text shows inline validation
 * and reverts to the last good value on blur.
 * ------------------------------------------------------------------ */

interface SettingNumberProps {
  path: string;
  value: number;
  meta?: NumericMeta;
  onChange: (next: number) => void;
}

export function SettingNumberInput({ path, value, meta, onChange }: SettingNumberProps) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const min = meta?.min ?? 0;
  const max = meta?.max ?? 100000;
  const unit = meta?.unit;

  const handleChange = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      setError(`Enter ${unit ? `a value (${unit})` : 'a value'} between ${min} and ${max}`);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      setError('Enter a valid number');
      return;
    }
    if (parsed < min || parsed > max) {
      setError(`Must be between ${min} and ${max}${unit ? ` ${unit}` : ''}`);
      return;
    }
    setError(null);
    onChange(parsed);
  };

  return (
    <div className={`w-full xl:w-[190px] ${error ? '' : ''}`}>
      <div className="relative">
        <input
          key={`${path}-${value}`}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={meta?.step ?? 1}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            if (error) {
              setText(String(value));
              setError(null);
            }
          }}
          aria-invalid={Boolean(error)}
          aria-label={path}
          className={`tnum h-[34px] w-full rounded-[5px] border bg-[#0c1424] px-2.5 text-[13px] text-ink transition-all ${focusRing} ${
            error ? 'border-accent-red/70 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-edge'
          } ${unit ? 'pr-[58px]' : ''}`}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-faint">
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 max-w-[220px] text-[10.5px] leading-[12px] text-[#ff8b96]">{error}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Native select with caret
 * ------------------------------------------------------------------ */

interface SettingSelectProps {
  value: string | number;
  onChange: (next: string) => void;
  options: Array<{ value: string | number; label: string }>;
  ariaLabel?: string;
  width?: string;
}

export function SettingSelect({ value, onChange, options, ariaLabel, width }: SettingSelectProps) {
  return (
    <div className={`relative w-full ${width ?? 'xl:w-[280px]'}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-[34px] w-full cursor-pointer appearance-none rounded-[5px] border border-edge bg-[#0c1424] px-2.5 pr-8 text-[13px] text-ink transition-all hover:border-edge-strong ${focusRing}`}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value} className="bg-[#0c1424] text-ink">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented control
 * ------------------------------------------------------------------ */

interface SettingSegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; hint?: string }>;
  ariaLabel?: string;
}

export function SettingSegmented<T extends string>({ value, onChange, options, ariaLabel }: SettingSegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full flex-wrap items-center gap-0.5 rounded-[6px] border border-edge bg-[#0a1120] p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={`flex h-[27px] items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-medium transition-all ${
              active
                ? 'bg-gradient-to-r from-[#155e9e] to-[#123f7c] text-white shadow-[0_0_10px_-3px_rgba(47,125,255,0.9)] ring-1 ring-accent-blue/60'
                : 'text-ink-dim hover:bg-panel-hover hover:text-ink'
            }`}
          >
            {active ? <Check size={12} strokeWidth={2.6} className="text-accent-cyan" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chip multi-select (classes, plate formats, layers, severities…)
 * ------------------------------------------------------------------ */

interface SettingChipsProps {
  value: string[];
  onChange: (next: string[]) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel?: string;
  minSelection?: number;
}

export function SettingChips({ value, onChange, options, ariaLabel, minSelection = 1 }: SettingChipsProps) {
  const toggle = (optionValue: string) => {
    const next = value.includes(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    if (next.length < minSelection) return;
    onChange(next);
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={`flex items-center gap-1.5 rounded-[5px] border px-2.5 py-[5px] text-[12px] font-medium transition-all ${
              active
                ? 'border-accent-cyan/60 bg-accent-cyan/10 text-[#a5f3fc] shadow-[0_0_10px_-4px_rgba(34,211,238,0.8)]'
                : 'border-edge bg-[#0c1424] text-ink-dim hover:border-edge-strong hover:text-ink'
            }`}
          >
            {active ? (
              <Check size={11} strokeWidth={3} className="text-accent-cyan" />
            ) : (
              <span className="h-[7px] w-[7px] rounded-[2px] border border-edge-strong" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Slider with value readout. Fill gradient tracks the percentage so
 * the control reads instantly.
 * ------------------------------------------------------------------ */

interface SettingSliderProps {
  value: number;
  meta?: NumericMeta;
  onChange: (next: number) => void;
  /** Optional extra readout appended after the numeric value. */
  readout?: string;
  ariaLabel?: string;
}

export function SettingSlider({ value, meta, onChange, readout, ariaLabel }: SettingSliderProps) {
  const min = meta?.min ?? 0;
  const max = meta?.max ?? 100;
  const step = meta?.step ?? 1;
  const pct = ((value - min) / (max - min)) * 100;
  const unit = meta?.unit;

  return (
    <div className="flex w-full items-center gap-3 xl:w-[300px]">
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="s-range min-w-0 flex-1 cursor-pointer"
        style={{
          background: `linear-gradient(to right, #22d3ee 0%, #0891b2 ${pct}%, #1b2b47 ${pct}%, #1b2b47 100%)`,
        }}
      />
      <span className="tnum w-[64px] shrink-0 rounded-[4px] border border-edge bg-[#0a1120] px-1.5 py-[3px] text-center text-[11.5px] font-semibold text-[#a5f3fc]">
        {value}
        {unit ? <span className="text-[10px] font-medium text-ink-faint"> {unit}</span> : null}
      </span>
      {readout ? <span className="hidden shrink-0 text-[11px] text-ink-faint lg:inline">{readout}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small status / info chip
 * ------------------------------------------------------------------ */

interface StateChipProps {
  children: ReactNode;
  tone?: 'green' | 'cyan' | 'amber' | 'red' | 'slate' | 'purple';
  pulse?: boolean;
}

const chipTones: Record<NonNullable<StateChipProps['tone']>, string> = {
  green: 'border-accent-green/40 bg-[#0b2e26] text-[#6fe0b0]',
  cyan: 'border-accent-cyan/40 bg-[#082a36] text-[#7de3f8]',
  amber: 'border-[#f59e0b]/40 bg-[#2b1a06] text-[#f7b95f]',
  red: 'border-accent-red/40 bg-[#2b0b10] text-[#ff8b96]',
  slate: 'border-edge bg-[#101a2e] text-ink-dim',
  purple: 'border-accent-purple/40 bg-[#241a3d] text-[#d8b3f7]',
};

export function StateChip({ children, tone = 'slate', pulse }: StateChipProps) {
  const dotColor = {
    green: 'bg-accent-green',
    cyan: 'bg-accent-cyan',
    amber: 'bg-accent-orange',
    red: 'bg-accent-red',
    slate: 'bg-ink-faint',
    purple: 'bg-accent-purple',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11px] font-semibold ${chipTones[tone]}`}
    >
      {pulse ? <span className={`h-1.5 w-1.5 rounded-full ${dotColor} animate-pulse-dot`} /> : null}
      {children}
    </span>
  );
}

/** Neutral informational callout strip used across sections. */
export function InfoNote({ children, icon: Icon = Info, tone = 'cyan' }: { children: ReactNode; icon?: LucideIcon; tone?: 'cyan' | 'amber' | 'red' | 'slate' }) {
  const wrap = {
    cyan: 'border-accent-cyan/30 bg-[#0a1f2c] text-[#9ad6e8]',
    amber: 'border-[#f59e0b]/30 bg-[#231a08] text-[#e8c888]',
    red: 'border-accent-red/30 bg-[#26090e] text-[#eba3aa]',
    slate: 'border-edge bg-[#0d1526] text-ink-dim',
  }[tone];
  const iconCls = {
    cyan: 'text-accent-cyan',
    amber: 'text-[#fbbf24]',
    red: 'text-[#f87171]',
    slate: 'text-ink-faint',
  }[tone];
  return (
    <p className={`flex items-start gap-2 rounded-[5px] border px-2.5 py-2 text-[11.5px] leading-[15px] ${wrap}`}>
      <Icon size={13} strokeWidth={2} className={`mt-px shrink-0 ${iconCls}`} />
      <span>{children}</span>
    </p>
  );
}
