import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  api,
  type JourneyDto,
  type SightingDto,
  type VehicleDto,
} from '@/services/api';
import type { JourneyNode, Sighting, VehicleProfile } from '@/data/vehicleSearchData';

/**
 * Live Vehicle Intelligence data for the Vehicle Search workspace.
 *
 * Fetches the real backend (Vehicle Identity + sightings + cross-camera
 * journey) and maps it onto the exact shapes the existing panels already
 * render — so the Gujarat Police UI is unchanged, only the data is real. When
 * the backend has no record for a plate (or is unreachable) the caller keeps
 * its mock fallback, so the design never breaks.
 */

function clockOf(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function secondsOf(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function splitLocation(name: string | null | undefined): { location: string; city: string } {
  if (!name) return { location: 'Unknown', city: 'Gujarat' };
  const parts = name.split(',').map((p) => p.trim());
  if (parts.length >= 2) return { location: parts[0], city: parts.slice(1).join(', ') };
  return { location: name, city: 'Gujarat' };
}

function toSighting(s: SightingDto): Sighting {
  const loc = splitLocation(s.location_name);
  return {
    id: `VS-${s.id}`,
    timestamp: clockOf(s.seen_at),
    seconds: secondsOf(s.seen_at),
    cameraId: s.camera_id,
    location: loc.location,
    city: loc.city,
    direction: '—',
    vehicleType: s.vehicle_class ? `${s.vehicle_class}` : 'Vehicle',
    confidence: Number(((s.ocr_confidence ?? 0) * 100).toFixed(1)),
    matchStatus: (s.ocr_confidence ?? 0) >= 0.9 ? 'Confirmed' : 'Matched',
    snapshot: '',
    speedKph: 0,
    lane: `Track ${s.track_id ?? '—'}`,
  };
}

function toProfile(v: VehicleDto): VehicleProfile {
  const loc = splitLocation(v.recent_sightings?.[0]?.location_name);
  return {
    plate: v.plate,
    watchlistMatch: false,
    watchlistCategory: '—',
    vehicleType: v.vehicle_class ?? 'Vehicle',
    make: '—',
    model: '—',
    year: 0,
    color: '—',
    fuel: '—',
    registrationState: v.plate.slice(0, 2),
    registeredOwner: '—',
    confidence: Number(((v.best_confidence ?? 0) * 100).toFixed(1)),
    totalSightings: v.total_sightings,
    firstSeen: clockOf(v.first_seen),
    lastSeen: clockOf(v.last_seen),
    status: 'Active Tracking',
    currentCamera: v.last_camera_id ?? '—',
    currentLocation: loc.location,
    currentCity: loc.city,
    currentDirection: '—',
    currentSpeed: 0,
    detectionConfidence: Number(((v.best_confidence ?? 0) * 100).toFixed(1)),
    latestEvent: `Seen at ${v.last_camera_id ?? '—'}`,
    snapshot: '',
  };
}

function toJourneyNodes(journey: JourneyDto): JourneyNode[] {
  return journey.points.map((p, i) => {
    const loc = splitLocation(p.location_name);
    return {
      step: i + 1,
      cameraId: p.camera_id,
      location: loc.location,
      city: loc.city,
      timestamp: clockOf(p.timestamp),
      seconds: secondsOf(p.timestamp),
      thumbnail: '',
      isWatchlistAlert: p.anomaly,
    };
  });
}

export interface VehicleSearchResult {
  loading: boolean;
  found: boolean;
  profile: VehicleProfile | null;
  sightings: Sighting[];
  journeyNodes: JourneyNode[];
  anomalies: number;
  error: string | null;
}

export function useVehicleSearch(plate: string, trigger: number): VehicleSearchResult {
  const [state, setState] = useState<VehicleSearchResult>({
    loading: false,
    found: false,
    profile: null,
    sightings: [],
    journeyNodes: [],
    anomalies: 0,
    error: null,
  });

  const run = useCallback(async (p: string) => {
    const normalized = p.replace(/\s+/g, '').toUpperCase();
    if (!normalized) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [vehicle, sightings, journey] = await Promise.all([
        api.getVehicleIdentity(normalized),
        api.getVehicleSightings(normalized).catch(() => [] as SightingDto[]),
        api.getVehicleJourneyReal(normalized).catch(
          () => ({ plate: normalized, point_count: 0, segment_count: 0, anomaly_count: 0, points: [] } as JourneyDto),
        ),
      ]);
      setState({
        loading: false,
        found: true,
        profile: toProfile(vehicle),
        sightings: sightings.map(toSighting),
        journeyNodes: toJourneyNodes(journey),
        anomalies: journey.anomaly_count,
        error: null,
      });
    } catch (err) {
      setState({
        loading: false,
        found: false,
        profile: null,
        sightings: [],
        journeyNodes: [],
        anomalies: 0,
        error: err instanceof Error ? err.message : 'lookup failed',
      });
    }
  }, []);

  useEffect(() => {
    void run(plate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return useMemo(() => state, [state]);
}
