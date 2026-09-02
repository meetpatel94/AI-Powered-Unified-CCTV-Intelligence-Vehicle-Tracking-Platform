import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  ScrollText,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  AUDIT_STATUS_CHIP,
  NUMERIC_META_OF,
  SECTION_META,
  SEED_AUDIT_LOGS,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingRow,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { AuditActionKind, AuditLogEntry, AuditLogsConfig, AuditStatus, SettingValue } from '@/types/settings';

interface AuditLogsSectionProps {
  cfg: AuditLogsConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
  onExport: (rows: AuditLogEntry[]) => void;
}

const p = 'audit';

const PAGE_SIZE = 7;

const ACTION_LABELS: Record<AuditActionKind, string> = {
  login: 'Login / session',
  logout: 'Logout',
  config: 'Config change',
  security: 'Security',
  maintenance: 'Maintenance',
  export: 'Export',
  'user-admin': 'User admin',
};

const ACTION_TONE: Record<AuditActionKind, string> = {
  login: 'border-edge bg-[#101a2e] text-ink-dim',
  logout: 'border-edge bg-[#101a2e] text-ink-dim',
  config: 'border-accent-blue/40 bg-[#0d1c38] text-[#9fc7ff]',
  security: 'border-accent-red/40 bg-[#2b0b10] text-[#ff8b96]',
  maintenance: 'border-[#f59e0b]/40 bg-[#2b1a06] text-[#f7b95f]',
  export: 'border-accent-purple/40 bg-[#241a3d] text-[#d8b3f7]',
  'user-admin': 'border-accent-cyan/40 bg-[#082a36] text-[#7de3f8]',
};

/** Searchable activity ledger (mock of GET /api/v1/audit). */
export function AuditLogsSection({ cfg, patch, pending, onExport }: AuditLogsSectionProps) {
  const meta = SECTION_META.audit;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AuditActionKind | 'all'>('all');
  const [status, setStatus] = useState<AuditStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEED_AUDIT_LOGS.filter((entry) => {
      if (kind !== 'all' && entry.actionKind !== kind) return false;
      if (status !== 'all' && entry.status !== status) return false;
      if (!q) return true;
      return [entry.user, entry.action, entry.module, entry.ip, entry.detail, entry.role]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [query, kind, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalFiltered = filtered.length;

  const changePage = (next: number) => setPage(Math.min(Math.max(1, next), pageCount));

  return (
    <SectionPanel
      id="section-audit"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={
        <StateChip tone="cyan">
          <ShieldCheck size={11} /> chain hash verified
        </StateChip>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-3xs text-ink-faint">
          <span>Ledger head · block 12,847 — hash verified <span className="font-mono text-[9px] text-[#6fe0b0]">a1f9…c4e2</span></span>
          <span>1,284 events · last 30 days · mock dataset</span>
        </div>
      }
    >
      <SectionSubhead right="policy applies at write time">
        <span className="flex items-center gap-1.5">
          <ScrollText size={11} />
          Recording policy
        </span>
      </SectionSubhead>

      <SettingRow label="Audit record level" hint="How much of the activity spectrum the ledger captures.">
        <SettingSelect
          ariaLabel="Audit record level"
          value={cfg.recordLevel}
          onChange={(next) => patch(`${p}.recordLevel`, next)}
          options={[
            { value: 'all', label: 'All events' },
            { value: 'security-config', label: 'Security + configuration' },
            { value: 'critical-only', label: 'Critical security events only' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Audit log retention" hint="Immutable window before the ledger is sealed to cold storage.">
        <SettingSlider
          ariaLabel="Audit log retention"
          value={cfg.retentionDays}
          meta={NUMERIC_META_OF(`${p}.retentionDays`)}
          onChange={(next) => patch(`${p}.retentionDays`, next)}
        />
      </SettingRow>

      <SettingRow label="Tamper-evident hashing" hint="Chain every entry to the previous hash — any edit breaks the chain.">
        <SettingToggle
          checked={cfg.tamperEvidentHashing}
          onChange={(next) => patch(`${p}.tamperEvidentHashing`, next)}
          label="Tamper-evident hashing"
          caption
        />
      </SettingRow>

      <SettingRow label="Record request payloads" hint="Store the JSON body of privileged writes for incident replay.">
        <SettingToggle
          checked={cfg.includePayloads}
          onChange={(next) => patch(`${p}.includePayloads`, next)}
          label="Record request payloads"
          caption
        />
      </SettingRow>

      <SectionSubhead right={`${totalFiltered} visible`}>
        <span className="flex items-center gap-1.5">
          <FileSearch size={11} />
          Activity ledger
        </span>
      </SectionSubhead>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search user, action, module, IP…"
            className="h-[34px] w-full rounded-[5px] border border-edge bg-[#0c1424] pl-8 pr-2.5 text-[12.5px] text-ink outline-none transition-all placeholder:text-ink-faint focus:border-accent-blue/70 focus:shadow-[0_0_0_3px_rgba(47,125,255,0.13)]"
          />
        </div>
        <SettingSelect
          ariaLabel="Filter by action type"
          value={kind}
          onChange={(next) => {
            setKind(next as AuditActionKind | 'all');
            setPage(1);
          }}
          width="xl:w-[190px]"
          options={[
            { value: 'all', label: 'All actions' },
            ...(Object.keys(ACTION_LABELS) as AuditActionKind[]).map((key) => ({
              value: key,
              label: ACTION_LABELS[key],
            })),
          ]}
        />
        <SettingSelect
          ariaLabel="Filter by status"
          value={status}
          onChange={(next) => {
            setStatus(next as AuditStatus | 'all');
            setPage(1);
          }}
          width="xl:w-[160px]"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'success', label: 'Success' },
            { value: 'warning', label: 'Warning' },
            { value: 'failed', label: 'Failed' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
        <button
          type="button"
          onClick={() => onExport(visible)}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-[#0c1424] px-3 text-[12px] font-semibold text-[#c3cfe2] transition-colors hover:border-edge-strong hover:text-white"
        >
          <Download size={13} />
          <span className="hidden md:inline">Export CSV</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[6px] border border-edge">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {['Timestamp', 'User', 'Action', 'Module', 'IP address', 'Status'].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-edge bg-[#0a111f] px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.11em] text-ink-faint"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((entry, index) => (
              <tr key={entry.id} className={index % 2 === 1 ? 'bg-[#0a1120]/60' : ''}>
                <td className="whitespace-nowrap border-b border-edge/40 px-2.5 py-2 align-top">
                  <span className="tnum text-[11px] font-medium text-[#b9c8df]">{entry.timestamp}</span>
                  <span className="tnum block text-[9.5px] text-ink-faint">{entry.id}</span>
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-2.5 py-2 align-top">
                  <span className="block text-[12px] font-semibold text-[#dbe5f4]">{entry.user}</span>
                  <span className="block text-[9.5px] text-ink-faint">{entry.role}</span>
                </td>
                <td className="min-w-[180px] border-b border-edge/40 px-2.5 py-2 align-top">
                  <span
                    className={`inline-flex rounded-[3px] border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${ACTION_TONE[entry.actionKind]}`}
                  >
                    {ACTION_LABELS[entry.actionKind]}
                  </span>
                  <span className="mt-1 block text-[11px] leading-[13px] text-[#b9c8df]" title={entry.detail}>
                    {entry.detail}
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-2.5 py-2 align-top">
                  <span className="text-[11px] text-ink-dim">{entry.module}</span>
                </td>
                <td className="tnum whitespace-nowrap border-b border-edge/40 px-2.5 py-2 align-top font-mono text-[10.5px] text-ink-faint">
                  {entry.ip}
                </td>
                <td className="whitespace-nowrap border-b border-edge/40 px-2.5 py-2 align-top">
                  <span className={`inline-flex rounded-[3px] border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${AUDIT_STATUS_CHIP[entry.status]}`}>
                    {entry.status}
                  </span>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-ink-faint">
                  No audit events match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 text-[11px] text-ink-dim">
        <span>
          Showing{' '}
          <span className="tnum font-semibold text-[#c3cfe2]">
            {totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalFiltered)}
          </span>{' '}
          of <span className="tnum font-semibold text-[#c3cfe2]">{totalFiltered}</span> events
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => changePage(safePage - 1)}
            className="grid h-[26px] w-[26px] place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-ink-dim transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft size={13} />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setPage(num)}
              className={`tnum grid h-[26px] w-[26px] place-items-center rounded-[4px] border text-[11px] font-semibold transition-colors ${
                num === safePage
                  ? 'border-accent-blue/60 bg-gradient-to-r from-[#155e9e] to-[#123f7c] text-white'
                  : 'border-edge bg-[#0c1424] text-ink-dim hover:text-white'
              }`}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => changePage(safePage + 1)}
            className="grid h-[26px] w-[26px] place-items-center rounded-[4px] border border-edge bg-[#0c1424] text-ink-dim transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </SectionPanel>
  );
}
