import { CheckCircle2, Settings2 } from 'lucide-react';

import { SECTION_META } from '@/data/settingsData';

import type { SettingsSectionId } from '@/types/settings';

interface SettingsNavPanelProps {
  sections: SettingsSectionId[];
  activeId: SettingsSectionId;
  /** Per-section count of pending unsaved edits. */
  pendingBySection: Partial<Record<SettingsSectionId, number>>;
  onNavigate: (id: SettingsSectionId) => void;
}

/**
 * Left settings navigation — one entry per control area, with the live
 * pending-edit badge. Clicking scrolls the content column to the section.
 */
export function SettingsNavPanel({ sections, activeId, pendingBySection, onNavigate }: SettingsNavPanelProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="panel flex min-h-0 w-full flex-col overflow-hidden self-start"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-edge/80 bg-[#0a111f] px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#c7d4e8]">
          <Settings2 size={13} className="text-accent-cyan" />
          Configuration
        </h2>
        <span className="text-3xs uppercase tracking-wider text-ink-faint">14 modules</span>
      </div>

      <ul className="scroll-thin flex min-h-0 flex-1 gap-1 overflow-x-auto p-1.5 lg:flex-col lg:gap-y-px lg:overflow-x-visible lg:overflow-y-auto">
        {sections.map((id) => {
          const meta = SECTION_META[id];
          const Icon = meta.icon;
          const active = id === activeId;
          const pending = pendingBySection[id] ?? 0;
          return (
            <li key={id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'true' : undefined}
                className={`group relative flex min-w-[176px] w-full items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-left transition-all lg:min-w-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#132a52] to-[#0f1e3a] text-white ring-1 ring-accent-blue/50 shadow-[0_0_14px_-6px_rgba(47,125,255,0.9)]'
                    : 'text-ink-dim hover:bg-panel-hover hover:text-ink'
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-[16px] w-[3px] -translate-y-1/2 rounded-full transition-all ${
                    active ? meta.accentBar : 'opacity-0 group-hover:opacity-40'
                  } ${active ? '' : 'bg-ink-faint'}`}
                />
                <Icon
                  size={15}
                  strokeWidth={1.9}
                  className={`shrink-0 transition-colors ${active ? meta.iconColor : 'text-[#5f7295] group-hover:text-[#93a3bd]'}`}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{meta.label}</span>
                {pending > 0 ? (
                  <span className="tnum grid h-[17px] min-w-[17px] shrink-0 place-items-center rounded-full border border-accent-orange/50 bg-[#2b1a06] px-1 text-[10px] font-bold text-[#f7b95f]">
                    {pending}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 border-t border-edge/80 bg-[#0a111f] px-3 py-2">
        <p className="flex items-center gap-1.5 text-3xs leading-[13px] text-ink-faint">
          <CheckCircle2 size={11} className="shrink-0 text-accent-green" />
          Mock control plane · API-ready seams in the settings store
        </p>
      </div>
    </nav>
  );
}
