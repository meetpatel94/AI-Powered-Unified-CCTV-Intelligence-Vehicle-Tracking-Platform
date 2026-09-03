import { useEffect, useRef, useState } from 'react';
import { Bell, Car, MapPin, ShieldAlert, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { liveCameras as demoCameras } from '@/data/liveViewData';
import {
  knownPlates as demoPlates,
  vehicleProfile as demoVehicleProfile,
} from '@/data/vehicleSearchData';
import { watchlistEntries as demoWatchlist } from '@/data/watchlistData';
import { alerts as demoAlerts } from '@/data/alertsData';
import { api, type AlertDto, type RegistryCamera, type VehicleDto, type WatchlistEntryDto } from '@/services/api';
import { mapAlertDto } from '@/hooks/useIntelligence';

export type GlobalSearchKind = 'camera' | 'vehicle' | 'watchlist' | 'alert' | 'location';

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchKind;
  label: string;
  sub: string;
  to: string;
  icon: LucideIcon;
  tone: string;
}

export interface GlobalSearchState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  query: string;
  results: GlobalSearchResult[];
  error: string | null;
  /** True when every source fell back to bundled data (backend unreachable). */
  offline: boolean;
}

const KIND_ICON: Record<GlobalSearchKind, LucideIcon> = {
  camera: Video,
  vehicle: Car,
  watchlist: ShieldAlert,
  alert: Bell,
  location: MapPin,
};

const KIND_TONE: Record<GlobalSearchKind, string> = {
  camera: 'text-accent-cyan',
  vehicle: 'text-accent-blue',
  watchlist: 'text-accent-orange',
  alert: 'text-accent-red',
  location: 'text-accent-green',
};

function hit(query: string, ...parts: Array<string | null | undefined>): boolean {
  const q = query.toLowerCase();
  return parts.some((part) => Boolean(part) && part!.toLowerCase().includes(q));
}

function makeResult(kind: GlobalSearchKind, id: string, label: string, sub: string, to: string): GlobalSearchResult {
  return { id, kind, label, sub, to, icon: KIND_ICON[kind], tone: KIND_TONE[kind] };
}

/** Backend / demo camera registry into search results. */
function cameraResults(query: string, registry: RegistryCamera[], useFixtures: boolean): GlobalSearchResult[] {
  const sources: Array<{ id: string; location: string; city: string; department: string }> =
    registry.length > 0 || !useFixtures
      ? registry.map((cam) => ({
          id: cam.camera_id,
          location: cam.location_name ?? cam.camera_id,
          city: (cam.location_name ?? '').split(',').slice(1).join(',').trim() || 'Gujarat',
          department: cam.department ?? 'Gujarat Police',
        }))
      : demoCameras.map((cam) => ({ id: cam.id, location: cam.location, city: cam.city, department: cam.department }));

  return sources
    .filter((cam) => hit(query, cam.id, cam.location, cam.city, cam.department))
    .slice(0, 6)
    .map((cam) => makeResult('camera', cam.id, cam.id, `${cam.location} · ${cam.city}`, `/live-view?camera=${encodeURIComponent(cam.id)}`))
    .filter((result) => result.label.length > 0);
}

/** Backend / demo vehicle identity into search results. */
function vehicleResults(query: string, vehicles: VehicleDto[], useFixtures: boolean): GlobalSearchResult[] {
  const sources: Array<{ plate: string; className?: string; location?: string }> =
    vehicles.length > 0 || !useFixtures
      ? vehicles.map((v) => ({ plate: v.plate, className: v.vehicle_class ?? undefined }))
      : [
          ...demoPlates.map((p) => ({ plate: p.plate, className: p.sub })),
          { plate: demoVehicleProfile.plate, className: demoVehicleProfile.vehicleType },
        ];

  const seen = new Set<string>();
  return sources
    .filter((v) => {
      if (seen.has(v.plate)) return false;
      seen.add(v.plate);
      return hit(query, v.plate, v.className);
    })
    .slice(0, 6)
    .map((v) =>
      makeResult(
        'vehicle',
        v.plate,
        v.plate,
        v.className ?? 'Vehicle',
        `/vehicle-search?plate=${encodeURIComponent(v.plate)}`,
      ),
    );
}

/** Backend / demo watchlist entries into search results. */
function watchlistResults(query: string, entries: WatchlistEntryDto[], useFixtures: boolean): GlobalSearchResult[] {
  const sources: Array<{ id: string; label: string; details: string; category: string }> =
    entries.length > 0 || !useFixtures
      ? entries.map((entry) => ({
          id: String(entry.id),
          label: entry.label ?? entry.plate ?? String(entry.id),
          details: entry.description ?? '',
          category: entry.category ?? '',
        }))
      : demoWatchlist.map((entry) => ({
          id: entry.id,
          label: entry.label,
          details: entry.details ?? '',
          category: entry.categoryId ?? '',
        }));

  return sources
    .filter((entry) => hit(query, entry.label, entry.details, entry.category))
    .slice(0, 5)
    .map((entry) => makeResult('watchlist', entry.id, entry.label, entry.details || entry.category || 'Watchlist', '/watchlist'));
}

/** Backend / demo alerts into search results. */
function alertResults(query: string, alerts: AlertDto[], useFixtures: boolean): GlobalSearchResult[] {
  const mapped = alerts.length > 0 || !useFixtures
    ? alerts.map(mapAlertDto)
    : demoAlerts;

  return mapped
    .filter((alert) =>
      hit(query, alert.id, alert.title, alert.subject, alert.plate, alert.camera, alert.location, alert.city),
    )
    .slice(0, 6)
    .map((alert) =>
      makeResult(
        'alert',
        alert.id,
        alert.id,
        `${alert.title} · ${alert.camera} · ${alert.location}`,
        `/alerts?alert=${encodeURIComponent(alert.id)}`,
      ),
    );
}

/** Distinct locations from the matched cameras/alerts. */
function locationResults(query: string, cameras: GlobalSearchResult[], alerts: GlobalSearchResult[]): GlobalSearchResult[] {
  const seen = new Set<string>();
  const collect = (sub: string) => {
    const [location, ...cityParts] = sub.split('·');
    const city = cityParts.join('·').trim();
    const label = location.trim();
    if (!label) return;
    const key = `${label}::${city}`;
    if (seen.has(key)) return;
    seen.add(key);
    return makeResult('location', key, label, city ? `Area · ${city}` : 'Location', '/camera-map');
  };

  const out: GlobalSearchResult[] = [];
  for (const item of cameras) {
    const loc = collect(item.sub);
    if (loc && hit(query, item.sub)) out.push(loc);
  }
  for (const item of alerts) {
    const loc = collect(item.sub);
    if (loc && hit(query, item.sub)) out.push(loc);
  }
  return out.slice(0, 4);
}

/**
 * Debounced global search across cameras, vehicles, watchlist entries and
 * alerts using the existing backend APIs, with a fallback to the bundled
 * datasets when the backend is unreachable (the same contract every other
 * dashboard hook follows). Results always navigate to the correct page/detail.
 */
export function useGlobalSearch(query: string): GlobalSearchState {
  const [state, setState] = useState<GlobalSearchState>({
    status: 'idle',
    query: '',
    results: [],
    error: null,
    offline: false,
  });
  const registryRef = useRef<RegistryCamera[] | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ status: 'idle', query: '', results: [], error: null, offline: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading', query: trimmed, error: null }));

    const timer = window.setTimeout(async () => {
      let anyBackend = false;
      let anyError = false;

      // Camera registry is fetched lazily and cached for the session.
      let cameras: RegistryCamera[] = [];
      if (registryRef.current !== null) {
        cameras = registryRef.current;
      } else {
        try {
          cameras = await api.getRegistryCameras();
          registryRef.current = cameras;
          anyBackend = true;
        } catch {
          anyError = true;
        }
      }
      if (cancelled) return;

      const [vehicles, watchlist, alerts] = await Promise.allSettled([
        api.searchVehicles(trimmed, 8),
        api.getWatchlist({ query: trimmed, limit: 8 }),
        api.getAlerts({ limit: 60 }),
      ]);

      if (cancelled) return;

      const vehiclesValue = vehicles.status === 'fulfilled' ? vehicles.value : ([] as VehicleDto[]);
      const watchlistValue = watchlist.status === 'fulfilled' ? watchlist.value.items : ([] as WatchlistEntryDto[]);
      const alertsValue = alerts.status === 'fulfilled' ? alerts.value.items : ([] as AlertDto[]);

      if (vehicles.status === 'fulfilled') anyBackend = true;
      if (watchlist.status === 'fulfilled') anyBackend = true;
      if (alerts.status === 'fulfilled') anyBackend = true;
      if (vehicles.status === 'rejected') anyError = true;
      if (watchlist.status === 'rejected') anyError = true;
      if (alerts.status === 'rejected') anyError = true;

      // Only fall back to bundled fixtures when the backend is entirely
      // unreachable — never silently mix demo records into live results.
      const useFixtures = !anyBackend;
      const cameraHits = cameraResults(trimmed, cameras, useFixtures);
      const vehicleHits = vehicleResults(trimmed, vehiclesValue, useFixtures);
      const watchlistHits = watchlistResults(trimmed, watchlistValue, useFixtures);
      const alertHits = alertResults(trimmed, alertsValue, useFixtures);
      const locationHits = locationResults(trimmed, cameraHits, alertHits);

      const results = [
        ...cameraHits,
        ...vehicleHits,
        ...watchlistHits,
        ...alertHits,
        ...locationHits,
      ];

      if (results.length === 0 && !anyBackend && anyError) {
        setState({ status: 'error', query: trimmed, results: [], error: 'Search service unreachable', offline: true });
        return;
      }

      setState({
        status: 'ready',
        query: trimmed,
        results,
        error: results.length === 0 && anyError ? 'Search service unreachable' : null,
        offline: !anyBackend,
      });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return state;
}
