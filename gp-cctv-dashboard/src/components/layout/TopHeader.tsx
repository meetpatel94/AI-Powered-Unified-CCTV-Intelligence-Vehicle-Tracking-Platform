import { Bell, ChevronDown, Search, Settings, User } from 'lucide-react';

import { currentUser } from '@/data/mockData';

/** Global command bar: centered search, alert bell, settings and operator chip. */
export function TopHeader() {
  return (
    <header className="relative flex h-[62px] shrink-0 items-center justify-between border-b border-edge bg-[#070c17] px-4">
      {/* Centered global search */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="pointer-events-auto relative w-[420px]">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6d7f9e]"
          />
          <input
            type="text"
            placeholder="Search Vehicle / Camera / Location..."
            className="h-[34px] w-full rounded-[6px] border border-edge bg-[#0c1424] pl-9 pr-3 text-[11.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow"
          />
        </div>
      </div>

      <div className="w-[220px]" />

      {/* Right cluster */}
      <div className="relative z-10 flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-8 w-8 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <Bell size={17} strokeWidth={1.8} />
          <span className="tnum absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent-red px-[3px] text-[8px] font-bold text-white shadow-[0_0_8px_-1px_rgba(239,68,68,0.9)]">
            {currentUser.notifications}
          </span>
        </button>

        <button
          type="button"
          aria-label="Settings"
          className="grid h-8 w-8 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <Settings size={17} strokeWidth={1.8} />
        </button>

        <div className="ml-1 flex items-center gap-2 rounded-[6px] py-1 pl-1 pr-1.5 transition-colors hover:bg-panel-hover">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#111c31] text-[#9fb0cc] ring-1 ring-edge-strong">
            <User size={15} strokeWidth={1.9} />
          </span>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold text-white">{currentUser.name}</div>
            <div className="text-[9px] text-ink-dim">{currentUser.unit}</div>
          </div>
          <ChevronDown size={13} className="text-[#6d7f9e]" />
        </div>
      </div>
    </header>
  );
}
