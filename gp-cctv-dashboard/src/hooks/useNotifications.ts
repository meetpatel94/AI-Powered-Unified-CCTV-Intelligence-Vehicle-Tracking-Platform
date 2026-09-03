import { useCallback, useEffect, useMemo, useState } from 'react';

import { alerts as seedAlerts } from '@/data/alertsData';
import { api } from '@/services/api';
import { createRealtimeChannel } from '@/services/realtime';
import { mapAlertDto } from '@/hooks/useIntelligence';
import type { AlertRecord, AlertStatus } from '@/types/alerts';
import type { Severity } from '@/types';

/** Compact notification item consumed by the global notification bell. */
export interface AppNotification {
  id: string;
  title: string;
  subject: string;
  severity: Severity;
  status: AlertStatus;
  camera: string;
  location: string;
  time: string;
  ago: string;
  plate?: string;
}

function toNotification(alert: AlertRecord): AppNotification {
  return {
    id: alert.id,
    title: alert.title,
    subject: alert.subject,
    severity: alert.severity,
    status: alert.status,
    camera: alert.camera,
    location: alert.location,
    time: alert.time,
    ago: alert.ago,
    plate: alert.plate,
  };
}

function seedNotifications(): AppNotification[] {
  return seedAlerts
    .filter((alert) => alert.status === 'new')
    .slice(0, 12)
    .map(toNotification);
}

export interface NotificationsState {
  items: AppNotification[];
  count: number;
  loading: boolean;
  error: string | null;
  live: boolean;
  refresh: () => void;
}

/**
 * Live alert notifications for the global bell. Uses the existing alert
 * API + `/api/ws` `alert:new` / `alert:update` flow (like the Alerts console)
 * so the count and panel stay current. Falls back to the bundled alert
 * fixtures when the backend is unreachable — never fabricates results.
 */
export function useNotifications(): NotificationsState {
  const [items, setItems] = useState<AppNotification[]>(() => seedNotifications());
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getAlertStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const pull = useCallback(() => {
    Promise.all([
      api.getAlerts({ open_only: true, limit: 15 }).catch(() => null),
      api.getAlertStats(24).catch(() => null),
    ]).then(([page, statsDto]) => {
      setStats(statsDto);
      if (page) {
        // Alerts list reached (even if empty) — use the real open/current list.
        setLive(true);
        setError(null);
        setItems(page.items.slice(0, 15).map(mapAlertDto).map(toNotification));
      } else {
        // Backend unreachable — keep the bundled fixture notification set.
        setLive(false);
        setError('offline');
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 10000);
    const bus = createRealtimeChannel();
    const offNew = bus.on('alert:new', () => pull());
    const offUpdate = bus.on('alert:update', () => pull());
    const offAck = bus.on('alert:ack', () => pull());
    return () => {
      window.clearInterval(id);
      offNew();
      offUpdate();
      offAck();
      bus.close();
    };
  }, [pull]);

  const count = useMemo(() => (stats ? (stats.new ?? stats.active ?? items.length) : items.length), [stats, items]);

  return { items, count, loading, error, live, refresh: pull };
}
