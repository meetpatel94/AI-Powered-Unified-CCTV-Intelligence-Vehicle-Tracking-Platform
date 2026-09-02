import { Bell, ChevronDown, Search, Settings, User } from 'lucide-react';

import { currentUser } from '@/data/mockData';

/** Global command bar: centered search, alert bell, settings and operator chip. */
export function TopHeader() {
  return (
    <header className="relative flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-edge bg-[#070c17] px-5">
      {/* Centered global search */}
      <div className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex">
        <div className="pointer-events-auto relative w-[clamp(280px,24vw,460px)]">
          <Search
            size={16}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6d7f9e]"
          />
          <input
            type="text"
            placeholder="Search Vehicle / Camera / Location..."
            className="h-[38px] w-full rounded-[6px] border border-edge bg-[#0c1424] pl-9 pr-3 text-[13.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow"
          />
        </div>
      </div>

      <div className="w-[220px]" />

      {/* Right cluster */}
      <div className="relative z-10 flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <Bell size={18} strokeWidth={1.8} />
          <span className="tnum absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent-red px-1 text-[11.5px] font-bold text-white shadow-[0_0_8px_-1px_rgba(239,68,68,0.9)]">
            {currentUser.notifications}
          </span>
        </button>

        <button
          type="button"
          aria-label="Settings"
          className="grid h-9 w-9 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
        >
          <Settings size={18} strokeWidth={1.8} />
        </button>

        <div className="ml-1 flex items-center gap-2 rounded-[6px] py-1 pl-1 pr-2 transition-colors hover:bg-panel-hover">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#111c31] text-[#9fb0cc] ring-1 ring-edge-strong">
            <User size={17} strokeWidth={1.9} />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-white">{currentUser.name}</div>
            <div className="text-[13px] text-ink-dim">{currentUser.unit}</div>
          </div>
          <ChevronDown size={15} className="text-[#6d7f9e]" />
        </div>
      </div>
    </header>
  );
}
