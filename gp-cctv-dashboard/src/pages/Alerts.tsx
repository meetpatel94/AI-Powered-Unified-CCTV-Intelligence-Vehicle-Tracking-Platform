import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AlertDetailsPanel, type AlertDetailAction } from '@/components/alerts/AlertDetailsPanel';
import { AlertsFilterBar, type AlertScopeId, type AlertStatusFilter, type AlertWindow } from '@/components/alerts/AlertsFilterBar';
import { AlertsHeader } from '@/components/alerts/AlertsHeader';
import { AlertsKpiRow } from '@/components/alerts/AlertsKpiRow';
import { AlertsByTypePanel } from '@/components/alerts/AlertsByTypePanel';
import { AlertsOverTimePanel } from '@/components/alerts/AlertsOverTimePanel';
import { ResponseTimelinePanel } from '@/components/alerts/ResponseTimelinePanel';
import { SeverityDonutPanel } from '@/components/alerts/SeverityDonutPanel';
import { TopAlertLocationsPanel } from '@/components/alerts/TopAlertLocationsPanel';
import { AlertFeedPanel, type AlertSortMode } from '@/components/alerts/AlertFeedPanel';
import { severityRank } from '@/components/alerts/tones';
import { LiveActivityPanel } from '@/components/alerts/LiveActivityPanel';
import { alerts as seedAlerts, computeKpis } from '@/data/alertsData';
import { formatClock } from '@/hooks/useLiveClock';
import type { AlertRecord, AlertResponseEvent, AlertStatus } from '@/types/alerts';

const WINDOW_MINUTES: Record<AlertWindow, number> = {
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '12h': 720,
  day: Number.POSITIVE_INFINITY,
};

const PROGRESS_STATUSES: AlertStatus[] = ['acknowledged', 'investigating', 'escalated'];

/**
 * ALERT MANAGEMENT & RESPONSE screen: KPI strip, dense filter bar,
 * alert feed + live-activity/response rail, analytics bottom row and the
 * right-side ALERT DETAILS workspace. Frontend mock data only.
 */
export function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRecord[]>(seedAlerts);
  const [severity, setSeverity] = useState('all');
  const [group, setGroup] = useState('all');
  const [camera, setCamera] = useState('all');
  const [windowId, setWindowId] = useState<AlertWindow>('day');
  const [status, setStatus] = useState<AlertStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AlertSortMode>('newest');
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const flash = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  };

  const kpis = useMemo(() => computeKpis(alerts), [alerts]);

  const scopeCounts: Record<AlertScopeId, number> = useMemo(
    () => ({
      all: alerts.length,
      unreviewed: alerts.filter((a) => a.status === 'new').length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      progress: alerts.filter((a) => PROGRESS_STATUSES.includes(a.status)).length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
    }),
    [alerts],
  );

  const scope: AlertScopeId =
    status === 'new' && severity === 'all'
      ? 'unreviewed'
      : status === 'progress'
        ? 'progress'
        : status === 'resolved'
          ? 'resolved'
          : severity === 'critical' && status === 'all'
            ? 'critical'
            : severity === 'all' && status === 'all'
              ? 'all'
              : 'all';

  const dirty =
    severity !== 'all' || group !== 'all' || camera !== 'all' || windowId !== 'day' || status !== 'all' || query.trim() !== '';

  const visibleAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const limit = WINDOW_MINUTES[windowId];
    const list = alerts.filter((alert) => {
      if (severity !== 'all' && alert.severity !== severity) return false;
      if (group !== 'all' && alert.groupId !== group) return false;
      if (camera !== 'all' && alert.camera !== camera) return false;
      if (alert.minutesAgo > limit) return false;
      if (status === 'progress') {
        if (!PROGRESS_STATUSES.includes(alert.status)) return false;
      } else if (status !== 'all' && alert.status !== status) return false;
      if (!q) return true;
      return (
        alert.id.toLowerCase().includes(q) ||
        alert.title.toLowerCase().includes(q) ||
        alert.subject.toLowerCase().includes(q) ||
        (alert.plate ?? '').toLowerCase().includes(q) ||
        alert.camera.toLowerCase().includes(q) ||
        alert.location.toLowerCase().includes(q) ||
        alert.city.toLowerCase().includes(q) ||
        (alert.watchlistList ?? '').toLowerCase().includes(q)
      );
    });

    switch (sort) {
      case 'oldest':
        return [...list].sort((a, b) => b.minutesAgo - a.minutesAgo);
      case 'severity':
        return [...list].sort(
          (a, b) => severityRank[a.severity] - severityRank[b.severity] || a.minutesAgo - b.minutesAgo,
        );
      default:
        return [...list].sort((a, b) => a.minutesAgo - b.minutesAgo);
    }
  }, [alerts, severity, group, camera, windowId, status, query, sort]);

  const selectedAlert = alerts.find((alert) => alert.id === selectedId) ?? null;
  const railAlert = selectedAlert ?? visibleAlerts[0] ?? alerts[0] ?? null;

  const resetFilters = () => {
    setSeverity('all');
    setGroup('all');
    setCamera('all');
    setWindowId('day');
    setStatus('all');
    setQuery('');
  };

  const handleScope = (next: AlertScopeId) => {
    if (next === 'critical') {
      setSeverity('critical');
      setStatus('all');
    } else if (next === 'unreviewed') {
      setSeverity('all');
      setStatus('new');
    } else if (next === 'progress') {
      setSeverity('all');
      setStatus('progress');
    } else if (next === 'resolved') {
      setSeverity('all');
      setStatus('resolved');
    } else {
      resetFilters();
    }
  };

  const handleKpi = (id: 'total' | 'critical' | 'high' | 'medium' | 'resolved') => {
    if (id === 'total') {
      setSeverity('all');
      setStatus('all');
      return;
    }
    if (id === 'resolved') {
      setStatus(status === 'resolved' ? 'all' : 'resolved');
      return;
    }
    setSeverity(severity === id ? 'all' : id);
  };

  const activeKpi =
    status === 'resolved' ? 'resolved' : severity === 'critical' || severity === 'high' || severity === 'medium' ? severity : null;

  const appendEvent = (alert: AlertRecord, event: Omit<AlertResponseEvent, 'id' | 'time' | 'ago'>): AlertRecord => ({
    ...alert,
    timeline: [
      ...alert.timeline,
      {
        ...event,
        id: `${alert.id}-ops-${Date.now()}-${alert.timeline.length}`,
        time: formatClock(new Date()),
        ago: 'just now',
      },
    ],
  });

  const applyStatus = (
    id: string,
    next: AlertStatus,
    event: Omit<AlertResponseEvent, 'id' | 'time' | 'ago'>,
  ) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === id ? appendEvent({ ...alert, status: next }, event) : alert)));
  };

  const handleAction = (alert: AlertRecord, action: AlertDetailAction, payload?: string) => {
    switch (action) {
      case 'acknowledge':
        applyStatus(alert.id, 'acknowledged', {
          label: 'Acknowledged by operator',
          detail: `Reviewed at console — ${alert.id} moved to acknowledged queue`,
          actor: 'Insp. Rajveer',
          tone: 'cyan',
        });
        flash(`${alert.id} acknowledged`);
        break;
      case 'investigate':
        applyStatus(alert.id, 'investigating', {
          label: 'Investigation opened',
          detail: 'Cross-camera reconstruction + registry pull requested',
          actor: 'Insp. Rajveer',
          tone: 'purple',
        });
        flash(`${alert.id} investigation opened`);
        break;
      case 'escalate':
        applyStatus(alert.id, 'escalated', {
          label: 'Escalated to supervisor',
          detail: 'Priority tone sent to control-room duty officer',
          actor: 'Insp. Rajveer',
          tone: 'red',
        });
        flash(`${alert.id} escalated to control room`);
        break;
      case 'resolve':
        applyStatus(alert.id, 'resolved', {
          label: 'Resolved',
          detail: 'Marked resolved from ALERT DETAILS workspace',
          actor: 'Insp. Rajveer',
          tone: 'green',
        });
        flash(`${alert.id} marked resolved`);
        break;
      case 'track':
        flash(
          alert.journey.length
            ? `Journey reconstructed — ${alert.journey.length} sightings pinned for ${alert.subject}`
            : `Registry pull requested for ${alert.subject} — no camera journey yet`,
        );
        break;
      case 'camera': {
        const code = payload ?? alert.camera;
        navigate(`/live-view?camera=${code}`);
        break;
      }
    }
  };

  const quickResolve = (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    applyStatus(id, 'resolved', {
      label: 'Resolved (quick action)',
      detail: 'Closed from feed card — no further action required',
      actor: 'Insp. Rajveer',
      tone: 'green',
    });
    flash(`${id} resolved`);
  };

  const markAllReviewed = () => {
    const targets = visibleAlerts.filter((alert) => alert.status === 'new');
    if (targets.length === 0) {
      flash('Nothing to review in the current selection');
      return;
    }
    const ids = new Set(targets.map((t) => t.id));
    setAlerts((prev) =>
      prev.map((alert) =>
        ids.has(alert.id)
          ? appendEvent({ ...alert, status: 'acknowledged' }, {
              label: 'Marked reviewed',
              detail: 'Bulk review from ALERT MANAGEMENT header',
              actor: 'Insp. Rajveer',
              tone: 'cyan',
            })
          : alert,
      ),
    );
    flash(`${targets.length} alert${targets.length > 1 ? 's' : ''} marked as reviewed`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 800);
    flash(`Feed synced · ${alerts.length} alerts · ${kpis.unreviewed} unreviewed`);
  };

  const handleExport = () => {
    const header = ['alert_id', 'type', 'severity', 'status', 'subject', 'camera', 'location', 'city', 'confidence_pct', 'time'];
    const rows = visibleAlerts.map((alert) =>
      [
        alert.id,
        alert.title,
        alert.severity,
        alert.status,
        alert.subject,
        alert.camera,
        `${alert.location}`,
        alert.city,
        alert.confidence.toFixed(1),
        alert.time,
      ]
        .map((cell) => (String(cell).includes(',') ? `"${cell}"` : String(cell)))
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gp-alerts-2026-09-01.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${visibleAlerts.length} alerts to CSV`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
      <AlertsHeader
        filtersVisible={filtersVisible}
        refreshing={refreshing}
        unreviewed={kpis.unreviewed}
        syncedAt="10:46 AM"
        onToggleFilters={() => setFiltersVisible((value) => !value)}
        onRefresh={handleRefresh}
        onExport={handleExport}
        onMarkAllReviewed={markAllReviewed}
      />

      <AlertsKpiRow kpis={kpis} activeKpi={activeKpi} onKpi={handleKpi} />

      {filtersVisible ? (
        <AlertsFilterBar
          scope={scope}
          onScope={handleScope}
          scopeCounts={scopeCounts}
          severity={severity}
          onSeverity={setSeverity}
          group={group}
          onGroup={setGroup}
          camera={camera}
          onCamera={setCamera}
          window={windowId}
          onWindow={setWindowId}
          status={status}
          onStatus={setStatus}
          query={query}
          onQuery={setQuery}
          onReset={resetFilters}
          dirty={dirty}
        />
      ) : null}

      {/* main workspace: feed + ops rail */}
      <div className="flex h-[470px] shrink-0 gap-2.5">
        <AlertFeedPanel
          alerts={visibleAlerts}
          totalCount={alerts.length}
          selectedId={selectedId}
          sort={sort}
          onSort={setSort}
          onSelect={(alert) => setSelectedId(alert.id)}
          onQuickResolve={quickResolve}
          onReset={resetFilters}
        />

        <aside className="flex w-[300px] shrink-0 flex-col gap-2.5">
          <div className="h-[212px] shrink-0">
            <LiveActivityPanel />
          </div>
          <ResponseTimelinePanel alert={railAlert} onOpen={(alert) => setSelectedId(alert.id)} />
        </aside>
      </div>

      {/* analytics bottom row */}
      <div className="flex h-[224px] shrink-0 gap-2.5">
        <div className="w-[29%] min-w-0">
          <AlertsByTypePanel alerts={alerts} />
        </div>
        <div className="w-[27%] min-w-0">
          <AlertsOverTimePanel />
        </div>
        <div className="w-[21%] min-w-0">
          <SeverityDonutPanel alerts={alerts} kpis={kpis} />
        </div>
        <div className="w-[23%] min-w-0">
          <TopAlertLocationsPanel />
        </div>
      </div>

      <AlertDetailsPanel alert={selectedAlert} onClose={() => setSelectedId(null)} onAction={handleAction} />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] animate-flash-in rounded-[6px] border border-accent-green/50 bg-[#0b2e26] px-3 py-2 text-[10.5px] font-medium text-[#6fe0b0] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
