import { LayoutGrid, List, Search, XCircle } from 'lucide-react';

import { departments } from '@/data/usersData';
import { selectCls } from '@/components/users/userTones';
import type { UserStatus } from '@/types/users';

export type SortMode = 'recent' | 'oldest' | 'name';
export type ViewMode = 'table' | 'grid';

export interface UserFilters {
  query: string;
  department: string;
  role: string;
  status: string;
  sort: SortMode;
  view: ViewMode;
}

interface UsersToolbarProps {
  filters: UserFilters;
  onChange: (next: UserFilters) => void;
  onReset: () => void;
  dirty: boolean;
  resultCount: number;
  totalCount: number;
}

const statusOptions: Array<{ value: UserStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'online', label: 'Online' },
  { value: 'away', label: 'Away' },
  { value: 'offline', label: 'Offline' },
  { value: 'invited', label: 'Pending Invitation' },
  { value: 'disabled', label: 'Disabled' },
];

/** Search / filter toolbar for the USER DIRECTORY. */
export function UsersToolbar({ filters, onChange, onReset, dirty, resultCount, totalCount }: UsersToolbarProps) {
  const set = (patch: Partial<UserFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-md border border-edge bg-panel px-2 py-2">
      {/* search */}
      <div className="relative h-[32px] min-w-[200px] flex-1 basis-[220px]">
        <Search size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]" />
        <input
          type="text"
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          placeholder="Search by Name / Email / Role..."
          className="h-full w-full rounded-[4px] border border-edge bg-[#0c1424] pl-8 pr-3 text-[12.5px] text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70"
        />
      </div>

      <select
        value={filters.department}
        onChange={(event) => set({ department: event.target.value })}
        className={`${selectCls} w-[168px]`}
      >
        <option value="all">All Departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.short}
          </option>
        ))}
      </select>

      <select
        value={filters.role}
        onChange={(event) => set({ role: event.target.value })}
        className={`${selectCls} w-[160px]`}
      >
        <option value="all">All Roles</option>
        <option value="super-admin">Super Administrator</option>
        <option value="command-inspector">Command Inspector</option>
        <option value="investigation-officer">Investigation Officer</option>
        <option value="traffic-analyst">Traffic Analyst</option>
        <option value="control-room-operator">Control Room Operator</option>
        <option value="viewer">Viewer</option>
      </select>

      <select
        value={filters.status}
        onChange={(event) => set({ status: event.target.value })}
        className={`${selectCls} w-[148px]`}
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={filters.sort}
        onChange={(event) => set({ sort: event.target.value as SortMode })}
        className={`${selectCls} w-[158px]`}
        title="Sort by last active"
      >
        <option value="recent">Last Active: Recent</option>
        <option value="oldest">Last Active: Oldest</option>
        <option value="name">Name A → Z</option>
      </select>

      {dirty ? (
        <button
          type="button"
          onClick={onReset}
          className="flex h-[32px] items-center gap-1 rounded-[4px] px-2 text-[12px] font-medium text-[#9fb0cc] transition-colors hover:text-white"
        >
          <XCircle size={13} />
          Reset
        </button>
      ) : null}

      <span className="mx-1 hidden h-[18px] w-px bg-edge md:block" />

      <span className="tnum hidden text-[11.5px] text-ink-dim lg:inline">
        {resultCount} of {totalCount} accounts
      </span>

      {/* grid / list toggle */}
      <div className="ml-auto flex shrink-0 items-center gap-px overflow-hidden rounded-[5px] border border-edge bg-[#0a1120] p-px">
        <button
          type="button"
          title="Table view"
          onClick={() => set({ view: 'table' })}
          className={`grid h-[28px] w-[34px] place-items-center rounded-[4px] transition-all ${
            filters.view === 'table'
              ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_10px_-3px_rgba(47,125,255,0.9)]'
              : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
          }`}
        >
          <List size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          title="Grid view"
          onClick={() => set({ view: 'grid' })}
          className={`grid h-[28px] w-[34px] place-items-center rounded-[4px] transition-all ${
            filters.view === 'grid'
              ? 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_10px_-3px_rgba(47,125,255,0.9)]'
              : 'text-[#8ea3c4] hover:bg-panel-hover hover:text-white'
          }`}
        >
          <LayoutGrid size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
