import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChangeHistoryTable } from '@/components/settings/ChangeHistoryTable';
import { ConfirmModal } from '@/components/settings/ConfirmModal';
import { SettingsNavPanel } from '@/components/settings/SettingsNavPanel';
import { SystemSettingsHeader } from '@/components/settings/SystemSettingsHeader';
import { SystemStatusPanel } from '@/components/settings/SystemStatusPanel';
import { ToastStack, type ToastKind, type ToastMessage } from '@/components/settings/ToastStack';
import { ApplyProgressModal } from '@/components/settings/ApplyProgressModal';
import { buildApplySteps } from '@/components/settings/applyRunbook';
import { AiDetectionSection } from '@/components/settings/sections/AiDetectionSection';
import { AnprOcrSection } from '@/components/settings/sections/AnprOcrSection';
import { AuditLogsSection } from '@/components/settings/sections/AuditLogsSection';
import { CameraStreamsSection } from '@/components/settings/sections/CameraStreamsSection';
import { GeneralSection } from '@/components/settings/sections/GeneralSection';
import { GisMapsSection } from '@/components/settings/sections/GisMapsSection';
import { MaintenanceSection } from '@/components/settings/sections/MaintenanceSection';
import { NotificationsSection } from '@/components/settings/sections/NotificationsSection';
import { PerformanceSection } from '@/components/settings/sections/PerformanceSection';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { StorageRetentionSection } from '@/components/settings/sections/StorageRetentionSection';
import { TrackingSection } from '@/components/settings/sections/TrackingSection';
import { UsersRolesSection } from '@/components/settings/sections/UsersRolesSection';
import { WatchlistAlertsSection } from '@/components/settings/sections/WatchlistAlertsSection';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { SESSION_ACTOR, SECTION_ORDER, sectionLabelOf } from '@/data/settingsData';

import type {
  AuditLogEntry,
  ChangeHistoryEntry,
  MaintenanceActionDef,
  SettingsSectionId,
  SettingPath,
  SettingValue,
} from '@/types/settings';

/**
 * SYSTEM SETTINGS — SYSTEM CONTROL CENTER workspace.
 *
 * One screen where the authorised administrator governs the whole
 * platform: general, camera streams, AI/ANPR, tracking, watchlist,
 * GIS, notifications, RBAC, retention, performance, security, audit
 * and maintenance. Everything is mock frontend state — the store hook
 * exposes the exact seams for the future config / auth / RTSP / AI /
 * database / WebSocket APIs.
 */
export function SystemSettings() {
  const settings = useSystemSettings();
  const { config, patch, changedPaths, dirtyCount, savedAt } = settings;

  const [activeId, setActiveId] = useState<SettingsSectionId>('general');
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyStep, setApplyStep] = useState(-1);
  const [applySubsystems, setApplySubsystems] = useState<SettingsSectionId[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<Array<number>>([]);

  const toastSeq = useRef(0);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const pushToast = (kind: ToastKind, title: string, detail?: string) => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev, { id, kind, title, detail }]);
    // Stack cap — drop the oldest after 4 are visible.
    timers.current.push(
      window.setTimeout(() => setToasts((prev) => (prev.length > 4 ? prev.slice(prev.length - 4) : prev)), 10),
    );
  };

  const dismissToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
    [],
  );

  /* ---------------- derived state ---------------- */

  const pendingBySection = useMemo(() => {
    const counts: Partial<Record<SettingsSectionId, number>> = {};
    changedPaths.forEach((path) => {
      const group = path.split('.')[0] as SettingsSectionId;
      counts[group] = (counts[group] ?? 0) + 1;
    });
    return counts;
  }, [changedPaths]);

  const dirtySections = Object.keys(pendingBySection).length;

  const validationErrors = useMemo(() => {
    const list: Array<{ path: SettingPath; message: string }> = [];
    const name = config.general.platformName.trim();
    if (name.length === 0) list.push({ path: 'general.platformName', message: 'Platform name is required.' });
    else if (name.length < 3) list.push({ path: 'general.platformName', message: 'Platform name must be at least 3 characters.' });
    return list;
  }, [config.general.platformName]);

  /* ---------------- scrollspy + navigation ---------------- */

  useEffect(() => {
    const root = document.querySelector('main');
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first?.target.id) {
          const id = first.target.id.replace('section-', '') as SettingsSectionId;
          setActiveId(id);
        }
      },
      { root, rootMargin: '-64px 0px -68% 0px', threshold: 0 },
    );
    SECTION_ORDER.forEach((id) => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navigateTo = (id: SettingsSectionId) => {
    setActiveId(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---------------- command flows ---------------- */

  const scrollToError = (path: SettingPath) => {
    const group = path.split('.')[0];
    navigateTo(group as SettingsSectionId);
  };

  const handleSave = () => {
    if (validationErrors.length > 0) {
      pushToast('error', 'Validation failed', `${validationErrors.length} field${validationErrors.length === 1 ? '' : 's'} need attention — see inline messages.`);
      scrollToError(validationErrors[0].path);
      return;
    }
    const rows = settings.save();
    if (rows.length === 0) return;
    pushToast(
      'success',
      'Configuration saved',
      `${rows.length} change${rows.length === 1 ? '' : 's'} recorded · ${SESSION_ACTOR} · ${rows[0].timestamp}`,
    );
  };

  const handleApply = () => {
    if (validationErrors.length > 0) {
      pushToast('error', 'Validation failed', `Resolve the ${validationErrors.length} flagged field${validationErrors.length === 1 ? '' : 's'} before applying.`);
      scrollToError(validationErrors[0].path);
      return;
    }
    const groups = Array.from(new Set(changedPaths.map((path) => path.split('.')[0]))) as SettingsSectionId[];
    setApplySubsystems(groups);
    setApplyStep(0);
    setApplyOpen(true);
  };

  // Drives the staged apply runbook with timer steps.
  useEffect(() => {
    if (!applyOpen) return;
    if (applyStep < 0) return;
    const steps = buildApplySteps(applySubsystems);
    if (applyStep >= steps.length) {
      const rows = settings.apply();
      if (rows.length > 0) {
        pushToast(
          'success',
          'Configuration applied — subsystems live',
          rows.length === 1
            ? `1 setting pushed to ${applySubsystems.map(sectionLabelOf).join(', ')}`
            : `${rows.length} settings pushed to ${applySubsystems.map(sectionLabelOf).join(', ')}`,
        );
      }
      const closeTimer = window.setTimeout(() => setApplyOpen(false), 1100);
      timers.current.push(closeTimer);
      return;
    }
    const timer = window.setTimeout(() => setApplyStep((step) => step + 1), 640);
    timers.current.push(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyOpen, applyStep, applySubsystems]);

  const handleReset = () => {
    settings.reset();
    setResetOpen(false);
    pushToast('warning', 'Draft reset', 'All unsaved changes discarded — restored to the last committed configuration.');
  };

  const handleMaintenanceComplete = (action: MaintenanceActionDef, result: string) => {
    settings.record(`Maintenance · ${action.label}`, `Last · ${action.lastRun}`, 'Completed · just now');
    pushToast('success', `${action.label} complete`, result);
  };

  const handleRotateKeys = () => {
    settings.record('Security · encryption keys', 'last rotated 14 days ago', 'rotated just now · next in 6 days', 'applied');
  };

  const handleKeyRotationNotice = (message: string) => pushToast('success', message);

  /* ---------------- CSV export helpers ---------------- */

  const downloadCsv = (filename: string, header: string[], dataRows: string[][]) => {
    const escape = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
    const csv = [header, ...dataRows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportHistory = (rows: ChangeHistoryEntry[]) => {
    if (rows.length === 0) {
      pushToast('warning', 'Nothing to export', 'No change records match the current filter.');
      return;
    }
    downloadCsv(
      'gp-config-changelog.csv',
      ['id', 'setting', 'previous', 'new', 'changed_by', 'timestamp', 'source', 'status'],
      rows.map((row) => [row.id, row.settingLabel, row.previous, row.next, row.changedBy, row.timestamp, row.source, row.status]),
    );
    pushToast('success', 'Change history exported', `${rows.length} record${rows.length === 1 ? '' : 's'} written to CSV.`);
  };

  const exportAudit = (rows: AuditLogEntry[]) => {
    if (rows.length === 0) {
      pushToast('warning', 'Nothing to export', 'No audit events match the current filters.');
      return;
    }
    downloadCsv(
      'gp-audit-ledger.csv',
      ['id', 'timestamp', 'user', 'role', 'action', 'module', 'ip', 'status', 'detail'],
      rows.map((entry) => [entry.id, entry.timestamp, entry.user, entry.role, entry.action, entry.module, entry.ip, entry.status, entry.detail]),
    );
    pushToast('success', 'Audit ledger exported', `${rows.length} event${rows.length === 1 ? '' : 's'} written to CSV.`);
  };

  /* ---------------- render ---------------- */

  const patchFn = (path: SettingPath, value: SettingValue) => patch(path, value);
  const pendingOf = (id: SettingsSectionId) => pendingBySection[id] ?? 0;

  const applyStepState = applyOpen ? applyStep : -1;

  return (
    <div className="page">
      <SystemSettingsHeader
        dirtyCount={dirtyCount}
        dirtySections={dirtySections}
        errorCount={validationErrors.length}
        onSave={handleSave}
        onReset={() => dirtyCount > 0 && setResetOpen(true)}
        onApply={handleApply}
      />

      {/* Three-column control workspace */}
      <div className="grid items-start gap-[var(--page-gap)] lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_292px]">
        <div className="min-w-0 lg:sticky lg:top-2 lg:flex lg:max-h-[calc(100vh-112px)]">
          <SettingsNavPanel
            sections={SECTION_ORDER}
            activeId={activeId}
            pendingBySection={pendingBySection}
            onNavigate={navigateTo}
          />
        </div>

        {/* Main settings area — fourteen configuration panels */}
        <div className="flex min-w-0 flex-col gap-[var(--page-gap)]">
          <GeneralSection cfg={config.general} patch={patchFn} pending={pendingOf('general')} />
          <CameraStreamsSection cfg={config.cameras} patch={patchFn} pending={pendingOf('cameras')} />
          <AiDetectionSection cfg={config.ai} patch={patchFn} pending={pendingOf('ai')} />
          <AnprOcrSection cfg={config.anpr} patch={patchFn} pending={pendingOf('anpr')} />
          <TrackingSection cfg={config.tracking} patch={patchFn} pending={pendingOf('tracking')} />
          <WatchlistAlertsSection cfg={config.watchlist} patch={patchFn} pending={pendingOf('watchlist')} />
          <GisMapsSection cfg={config.gis} patch={patchFn} pending={pendingOf('gis')} />
          <NotificationsSection cfg={config.notifications} patch={patchFn} pending={pendingOf('notifications')} onTestTone={() => pushToast('info', 'Playing alert tone', 'Tone preview · command-chime (mock — no audio in this build)')} />
          <UsersRolesSection cfg={config.users} patch={patchFn} pending={pendingOf('users')} />
          <StorageRetentionSection cfg={config.storage} patch={patchFn} pending={pendingOf('storage')} />
          <PerformanceSection cfg={config.performance} patch={patchFn} pending={pendingOf('performance')} />
          <SecuritySection cfg={config.security} patch={patchFn} pending={pendingOf('security')} onRotateKeys={handleRotateKeys} onNotice={handleKeyRotationNotice} />
          <AuditLogsSection cfg={config.audit} patch={patchFn} pending={pendingOf('audit')} onExport={exportAudit} />
          <MaintenanceSection cfg={config.maintenance} patch={patchFn} pending={pendingOf('maintenance')} onRunComplete={handleMaintenanceComplete} />
        </div>

        {/* Right-hand system status rail */}
        <div className="min-w-0">
          <SystemStatusPanel />
        </div>
      </div>

      {/* Bottom change-history ledger */}
      <ChangeHistoryTable recorded={settings.history} onExport={exportHistory} />

      {/* Overlays */}
      <ConfirmModal
        open={resetOpen}
        tone="warning"
        title="Discard unsaved changes?"
        message={`Reset will discard ${dirtyCount} pending change${dirtyCount === 1 ? '' : 's'} across ${dirtySections} section${dirtySections === 1 ? '' : 's'} and restore the last committed configuration.`}
        detail="This only affects the current draft — nothing has been pushed to the live subsystems yet."
        confirmLabel="Discard changes"
        onCancel={() => setResetOpen(false)}
        onConfirm={handleReset}
      />
      <ApplyProgressModal
        open={applyOpen}
        subsystems={applySubsystems}
        changeCount={dirtyCount}
        step={applyStepState}
        onClose={() => setApplyOpen(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {savedAt && dirtyCount === 0 ? (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[70] hidden -translate-x-1/2 md:block">
          <span className="flex items-center gap-1.5 rounded-full border border-edge bg-[#0a1324]/90 px-3 py-1 text-[10.5px] text-ink-dim shadow-panel backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-dot" />
            Configuration committed — snapshot synced at {new Date(savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
