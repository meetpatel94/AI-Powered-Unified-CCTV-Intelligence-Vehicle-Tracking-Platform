import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { useShell } from '@/components/layout/ShellContext';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { ProfileMenu } from '@/components/layout/ProfileMenu';

/**
 * Global command bar. Owns the sidebar collapse/expand toggle, the global
 * search, the live alert bell and the operator profile menu — all of which
 * are global and work identically on every page. The layout reflows to the
 * sidebar state and collapses the search to a compact icon on small screens.
 */
export function TopHeader() {
  const { collapsed, toggleSidebar } = useShell();

  return (
    <header className="relative flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-edge bg-[#070c17] px-3 sm:gap-3 sm:px-5">
      {/* Sidebar collapse / expand toggle (always accessible) */}
      <button
        type="button"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggleSidebar}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-[#93a3bd] transition-colors hover:bg-panel-hover hover:text-ink"
      >
        {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
      </button>

      {/* Centered global search (inline on desktop, icon on small screens) */}
      <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
        <GlobalSearch />
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
