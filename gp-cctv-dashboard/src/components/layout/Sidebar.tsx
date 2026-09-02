import { NavLink, useLocation } from 'react-router-dom';

import { GujaratPoliceEmblem } from '@/components/common/GujaratPoliceEmblem';
import { SystemStatusCard } from '@/components/layout/SystemStatusCard';
import { navItems } from '@/data/mockData';
import type { NavItem } from '@/types';

const baseItem =
  'group relative flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left transition-colors';
const activeItem =
  'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] font-medium text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)]';
const idleItem = 'text-ink-dim hover:bg-panel-hover hover:text-ink';

function ItemBody({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <>
      <Icon size={16} strokeWidth={1.9} className={isActive ? 'text-white' : 'text-[#7c8db0]'} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
      {item.badge ? (
        <span className="tnum rounded-[3px] bg-accent-red px-1.5 py-px text-3xs font-bold text-white shadow-[0_0_8px_-1px_rgba(239,68,68,0.9)]">
          {item.badge}
        </span>
      ) : null}
    </>
  );
}

/**
 * Fixed left rail: identity block, primary navigation and the live system
 * status footer. Built screens route via NavLink; the rest stay inert until
 * their modules land.
 */
export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="flex w-[var(--sidebar-w)] shrink-0 flex-col border-r border-edge bg-[#070c17]">
      {/* Identity */}
      <div className="flex h-[var(--header-h)] shrink-0 items-center gap-2.5 border-b border-edge px-3">
        <GujaratPoliceEmblem size={38} className="shrink-0 drop-shadow-[0_0_6px_rgba(47,125,255,0.35)]" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-semibold leading-[18px] tracking-tight text-white">
            Gujarat Police
          </div>
          <div className="block truncate text-[10px] leading-[13px] tracking-tight text-ink-dim">
            Unified AI CCTV Intelligence Platform
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              {item.available ? (
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `${baseItem} ${isActive ? activeItem : idleItem}`}
                >
                  <ItemBody item={item} isActive={pathname === item.path} />
                </NavLink>
              ) : (
                <button
                  type="button"
                  title={`${item.label} — module in development`}
                  className={`${baseItem} ${idleItem}`}
                >
                  <ItemBody item={item} isActive={false} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-2 pb-2.5">
        <SystemStatusCard />
        <div className="px-1.5 pt-2 text-3xs text-[#5c6b87]">© 2026 Gujarat Police</div>
      </div>
    </aside>
  );
}
