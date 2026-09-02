import { Download, RefreshCw, Upload, UserPlus, UsersRound } from 'lucide-react';

interface UsersHeaderProps {
  refreshing: boolean;
  syncedAt: string;
  pendingInvitations: number;
  onAddUser: () => void;
  onRefresh: () => void;
  onImport: () => void;
  onExport: () => void;
}

/**
 * Page title bar: USERS & ROLES identity + Add User / Import / Export / Refresh
 * actions. Matches the header treatment used on Alerts & Watchlist.
 */
export function UsersHeader({
  refreshing,
  syncedAt,
  pendingInvitations,
  onAddUser,
  onRefresh,
  onImport,
  onExport,
}: UsersHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="page-title flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[8px] border border-accent-purple/40 bg-accent-purple/15 shadow-[0_0_12px_-3px_rgba(168,85,247,0.55)]">
            <UsersRound size={18} className="text-accent-purple" />
          </span>
          Users &amp; Roles
        </h1>
        <p className="page-sub mt-1">Manage operators, permissions and system access</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="mr-1 hidden items-center gap-1.5 text-[12px] text-ink-dim xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
          synced {syncedAt}
          {pendingInvitations > 0 ? (
            <span className="tnum ml-1 font-semibold text-[#f6b95c]">
              {pendingInvitations} invites pending
            </span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={onAddUser}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-[#7d3fc8] bg-gradient-to-r from-[#8b3fe8] to-[#6d28d9] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(168,85,247,0.9)] transition-all hover:brightness-110"
        >
          <UserPlus size={15} strokeWidth={2.4} />
          + Add User
        </button>

        <button
          type="button"
          title="Import users from CSV"
          onClick={onImport}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <Upload size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          type="button"
          title="Export user directory as CSV"
          onClick={onExport}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <Download size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Export</span>
        </button>

        <button
          type="button"
          title="Refresh directory"
          onClick={onRefresh}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel px-3 text-[12.5px] font-medium text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin text-accent-cyan' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}
