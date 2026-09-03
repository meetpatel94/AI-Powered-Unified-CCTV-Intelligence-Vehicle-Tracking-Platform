import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

/** Persisted sidebar-collapse key (matches the app's existing localStorage approach). */
const STORAGE_KEY = 'gp.cctv.sidebar.collapsed';

/** Compact icon rail width in px. */
export const COLLAPSED_SIDEBAR_W = 72;
/** Full labelled sidebar width in px. */
export const EXPANDED_SIDEBAR_W = 228;

interface ShellContextValue {
  /** True when the sidebar is in compact icon-only mode. */
  collapsed: boolean;
  /** Effective sidebar width in px for the current state. */
  sidebarWidth: number;
  toggleSidebar: () => void;
  setCollapsed: (value: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

function readStoredCollapsed(): boolean {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
  } catch {
    /* storage unavailable — fall through to viewport default */
  }
  // Small screens (≤1023px) start collapsed so the command surface never
  // overflows the viewport.
  if (typeof window !== 'undefined') {
    try {
      return window.matchMedia('(max-width: 1023px)').matches;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * App-shell state owner. It owns the single, global sidebar collapse flag
 * (persisted across navigation and page refresh) so both the sidebar and the
 * top navbar agree on layout without any per-page duplication.
 */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readStoredCollapsed());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage may be unavailable — state still works for the session */
    }
  }, [collapsed]);

  const value = useMemo<ShellContextValue>(
    () => ({
      collapsed,
      sidebarWidth: collapsed ? COLLAPSED_SIDEBAR_W : EXPANDED_SIDEBAR_W,
      toggleSidebar: () => setCollapsedState((prev) => !prev),
      setCollapsed: setCollapsedState,
    }),
    [collapsed],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** CSS variable binding so the sidebar width transitions smoothly. */
export function useSidebarCssVar(): CSSProperties {
  const { sidebarWidth } = useShell();
  return useMemo<CSSProperties>(
    () => ({ '--sidebar-w': `${sidebarWidth}px` }) as CSSProperties,
    [sidebarWidth],
  );
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used within a ShellProvider');
  return context;
}
