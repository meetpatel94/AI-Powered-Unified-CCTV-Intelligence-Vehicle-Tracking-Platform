import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
import { useAlertsConsole, useAiActivity } from '@/hooks/useIntelligence';
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
 * right-side ALERT DETAILS workspace. Live alerts stream in from the
 * FastAPI backend (WS `alert:new` / `alert:update`); actions POST back to
 * `/api/alerts/*` with optimistic local UI and mock fallback offline.
 */
export function Alerts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intel = useAlertsConsole();
  const activity = useAiActivity(24);
  const [alerts, setAlerts] = useState<AlertRecord[]>(seedAlerts);
  const [syncedAt, setSyncedAt] = useState('10:46 AM');
  const [liveFeed, setLiveFeed] = useState(false);

  // Adopt backend alerts whenever the console hook pulls a fresh page.
  useEffect(() => {
    if (intel.live) {
      setLiveFeed(true);
      setAlerts(intel.alerts);
      setSyncedAt(formatClock(new Date()).replace(/\s?[AP]M$/i, ''));
    }
  }, [intel.alerts, intel.live]);
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

  // Deep link from the global search / notification bell: open a specific alert.
  const paramAlert = searchParams.get('alert');
  useEffect(() => {
    if (paramAlert) setSelectedId(paramAlert);
  }, [paramAlert]);

  const kpis = useMemo(() => computeKpis(alerts), [alerts]);

  // Real camera locations ranked by live alert volume (mock ranking offline).
  const topLocations = useMemo(() => {
    if (!liveFeed) return undefined;
    const byLocation = new Map<string, { count: number; city: string }>();
    alerts.forEach((alert) => {
      const hit = byLocation.get(alert.location);
      byLocation.set(alert.location, {
        count: (hit?.count ?? 0) + 1,
        city: hit?.city ?? alert.city,
      });
    });
    return [...byLocation.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, { count, city }], index) => ({
        id: `loc-${index}`,
        rank: index + 1,
        name,
        city,
        alerts: count,
        peak: '—',
        trend: 'flat' as const,
      }));
  }, [alerts, liveFeed]);

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
        void intel.acknowledge(alert.id);
        applyStatus(alert.id, 'acknowledged', {
          label: 'Acknowledged by operator',
          detail: `Reviewed at console — ${alert.id} moved to acknowledged queue`,
          actor: 'Insp. Rajveer',
          tone: 'cyan',
        });
        flash(`${alert.id} acknowledged`);
        break;
      case 'investigate':
        void intel.setStatus(alert.id, 'investigating');
        applyStatus(alert.id, 'investigating', {
          label: 'Investigation opened',
          detail: 'Cross-camera reconstruction + registry pull requested',
          actor: 'Insp. Rajveer',
          tone: 'purple',
        });
        flash(`${alert.id} investigation opened`);
        break;
      case 'escalate':
        void intel.setStatus(alert.id, 'escalated');
        applyStatus(alert.id, 'escalated', {
          label: 'Escalated to supervisor',
          detail: 'Priority tone sent to control-room duty officer',
          actor: 'Insp. Rajveer',
          tone: 'red',
        });
        flash(`${alert.id} escalated to control room`);
        break;
      case 'resolve':
        void intel.resolve(alert.id);
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
    void intel.resolve(id);
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
    targets.forEach((target) => void intel.setStatus(target.id, 'acknowledged'));
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
    intel.refresh();
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
    <div className="page">
      <AlertsHeader
        filtersVisible={filtersVisible}
        refreshing={refreshing}
        unreviewed={kpis.unreviewed}
        syncedAt={liveFeed ? syncedAt : '10:46 AM'}
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
      <div
        className="responsive-band responsive-band-main grid shrink-0 grid-cols-1 gap-[var(--page-gap)] lg:grid-cols-[minmax(0,1fr)_minmax(330px,360px)]"
      >
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

        <aside className="grid min-w-0 grid-cols-1 gap-[var(--page-gap)] sm:grid-cols-2 lg:flex lg:flex-col">
          <div className="min-w-0">
            <LiveActivityPanel />
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:min-h-0 lg:flex-1">
            <ResponseTimelinePanel alert={railAlert} onOpen={(alert) => setSelectedId(alert.id)} />
          </div>
        </aside>
      </div>

      {/* analytics bottom row */}
      <div
        className="responsive-band responsive-band-chart grid shrink-0 grid-cols-1 gap-[var(--page-gap)] sm:grid-cols-2 xl:grid-cols-[29fr_27fr_21fr_23fr]"
      >
        <div className="min-w-0">
          <AlertsByTypePanel alerts={alerts} />
        </div>
        <div className="min-w-0">
          <AlertsOverTimePanel
            series={
              activity.series && activity.live
                ? activity.series.points.map((point) => ({
                    label: point.bucket.slice(11, 13),
                    value: point.alerts,
                  }))
                : undefined
            }
          />
        </div>
        <div className="min-w-0">
          <SeverityDonutPanel alerts={alerts} kpis={kpis} />
        </div>
        <div className="min-w-0">
          <TopAlertLocationsPanel locations={topLocations} />
        </div>
      </div>

      <AlertDetailsPanel alert={selectedAlert} onClose={() => setSelectedId(null)} onAction={handleAction} />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[60] animate-flash-in rounded-[6px] border border-accent-green/50 bg-[#0b2e26] px-3 py-2 text-[12.5px] font-medium text-[#6fe0b0] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
