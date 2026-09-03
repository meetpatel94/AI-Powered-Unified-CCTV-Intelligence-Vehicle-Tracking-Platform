import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, Shield, User, Users } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { readStoredToken, storeAccessToken } from '@/services/realtime';

/**
 * Profile menu. Shows the current logged-in operator from the existing
 * auth/user state and surfaces only the actions that already exist
 * (System Settings, Users & Roles, dashboard) plus a real sign-out that
 * clears the stored token when a session is present. It never invents
 * authentication or login logic.
 */
export function ProfileMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { user, live } = useCurrentUser();
  const [hasSession] = useState(() => Boolean(readStoredToken()));

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const signOut = () => {
    // Uses the existing token-storage flow (no invented auth logic). A real
    // session is cleared and the app reloads into its initial state.
    storeAccessToken(null);
    setOpen(false);
    window.location.reload();
  };

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 flex items-center gap-2 rounded-[6px] py-1 pl-1 pr-2 transition-colors hover:bg-panel-hover"
        aria-haspopup="menu"
      >
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#111c31] text-[#9fb0cc] ring-1 ring-edge-strong">
          {initials ? <span className="tnum text-[12px] font-semibold">{initials}</span> : <User size={17} strokeWidth={1.9} />}
        </span>
        <span className="hidden leading-tight text-left sm:block">
          <span className="block text-[13px] font-semibold text-white">{user.name}</span>
          <span className="block text-[12px] text-ink-dim">{user.role}</span>
        </span>
        <ChevronDown size={15} className="hidden text-[#6d7f9e] sm:block" />
      </button>

      {open ? (
        <div className="animate-fade-in absolute right-0 top-[calc(100%+10px)] z-50 w-[264px] overflow-hidden rounded-md border border-edge bg-[#0b1222] shadow-panel">
          <div className="flex items-center gap-3 border-b border-edge px-3.5 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#111c31] text-[#9fb0cc] ring-1 ring-edge-strong">
              {initials ? <span className="tnum text-[14px] font-semibold">{initials}</span> : <User size={18} strokeWidth={1.9} />}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-semibold text-white">{user.name}</div>
              <div className="flex items-center gap-1 text-[11.5px] text-ink-dim">
                <Shield size={11} />
                <span className="truncate">{user.unit}</span>
              </div>
              {live ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-accent-green">
                  <span className="relative h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-accent-green" />
                    <span className="healthy-ping absolute inset-0 rounded-full text-accent-green" />
                  </span>
                  Live session
                </span>
              ) : null}
            </div>
          </div>

          <div className="py-1.5">
            <MenuItem icon={Shield} label="Command Dashboard" onClick={() => go('/')} />
            <MenuItem icon={Users} label="Users & Roles" onClick={() => go('/users-roles')} />
            <MenuItem icon={Settings} label="System Settings" onClick={() => go('/system-settings')} />
          </div>

          {hasSession ? (
            <div className="border-t border-edge py-1.5">
              <MenuItem icon={LogOut} label="Sign out" danger onClick={signOut} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof User;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] transition-colors hover:bg-panel-hover ${
        danger ? 'font-medium text-[#f87171]' : 'font-medium text-ink'
      }`}
    >
      <Icon size={15} strokeWidth={1.8} className={danger ? 'text-[#f87171]' : 'text-[#7c8db0]'} />
      {label}
    </button>
  );
}
