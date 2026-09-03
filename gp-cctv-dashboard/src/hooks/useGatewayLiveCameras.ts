import { useEffect, useMemo, useState } from 'react';

import { DEMO_MODE } from '@/config';
import { liveCameras as demoLiveCameras } from '@/data/liveViewData';
import { api, type RegistryCamera, type StreamStatusDto } from '@/services/api';
import { toLiveFrameUrl, toLiveMjpegUrl } from '@/services/streams';
import type { CameraStatus, Codec, LiveCamera, StreamQuality } from '@/types/liveView';

function mapState(state: string | undefined, fallback: CameraStatus): CameraStatus {
  switch ((state ?? '').toUpperCase()) {
    case 'LIVE':
      return 'online';
    case 'CONNECTING':
    case 'RECONNECTING':
      return 'reconnecting';
    case 'ERROR':
      return 'critical';
    case 'OFFLINE':
    case 'STOPPED':
      return 'offline';
    default:
      return fallback;
  }
}

function qualityFromRes(res: string | null | undefined): StreamQuality {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(res ?? '');
  if (!m) return 'HD';
  const h = Number(m[2]);
  if (h >= 2160) return '4K';
  if (h >= 1080) return 'FHD';
  if (h >= 720) return 'HD';
  return 'SD';
}

function mapCodec(raw: string | null | undefined, fallback: Codec): Codec {
  const u = (raw ?? '').toUpperCase();
  if (u.includes('265') || u.includes('HEVC')) return 'H.265';
  if (u.includes('264') || u.includes('AVC')) return 'H.264';
  if (u.includes('MJPEG') || u.includes('JPEG')) return 'MJPEG';
  return fallback;
}

function splitLocation(name: string | null): { location: string; city: string } {
  if (!name) return { location: 'Unknown', city: 'Gujarat' };
  const parts = name.split(',').map((p) => p.trim());
  if (parts.length >= 2) return { location: parts[0], city: parts.slice(1).join(', ') };
  return { location: name, city: 'Gujarat' };
}

/**
 * Merge the dynamic Camera Registry (Sentinel catalogue) with the Stream
 * Gateway status into the console's `LiveCamera` records.
 *
 * Production contract (`VITE_DEMO_MODE !== 'true'`):
 *   - ONLY cameras present in the real registry / gateway are shown. No
 *     government camera URL, coordinate or feed is hard-coded or fabricated.
 *   - When the registry/gateway is unreachable the result is EMPTY so the UI
 *     surfaces an offline state rather than silently presenting demo feeds as
 *     live operational cameras.
 *   - RTSP is never exposed: browser preview uses the gateway's in-memory
 *     JPEG/MJPEG endpoints (or the external HLS/WHEP gateway when configured).
 * Demo mode (`VITE_DEMO_MODE=true`): the bundled demo fixtures may be shown,
 * but only as an explicitly demo label.
 */
export function mergeLiveCameras(
  registry: RegistryCamera[],
  streams: StreamStatusDto[],
  tick: number,
  allowDemo = DEMO_MODE,
): LiveCamera[] {
  const realIds = new Set<string>([
    ...registry.map((c) => c.camera_id),
    ...streams.map((s) => s.camera_id),
  ]);

  // No real gateway/registry data at all.
  if (realIds.size === 0) {
    // Development/demo only — never a silent production fallback.
    return allowDemo ? demoLiveCameras : [];
  }

  const byId = new Map(streams.map((s) => [s.camera_id, s]));
  // Demo fixtures may enrich cosmetic fields ONLY in demo mode; in production
  // every value must come from the real registry/gateway.
  const demoById = new Map(demoLiveCameras.map((c) => [c.id, c]));

  return [...realIds]
    .sort()
    .map((id): LiveCamera => {
      const cam = registry.find((c) => c.camera_id === id);
      const st = byId.get(id);
      const demo = allowDemo ? demoById.get(id) : undefined;
      const loc = splitLocation(cam?.location_name ?? id);
      const live = st && ['LIVE', 'RECONNECTING', 'CONNECTING'].includes(st.state);
      const res = st?.resolution || cam?.resolution || '1920x1080';
      // Trust the gateway's live state. Without a stream a registry camera is
      // OFF in production (demo fixtures may seed a cosmetic status only when
      // VITE_DEMO_MODE=true).
      const status = mapState(st?.state, demo ? demo.status : 'offline');
      const online = status === 'online';
      return {
        id,
        location: loc.location,
        city: loc.city,
        zone: cam?.department ?? 'Command',
        department: cam?.department ?? 'Gujarat Police',
        thumbnail: live || online ? toLiveMjpegUrl(id) : toLiveFrameUrl(id, tick),
        liveFrameUrl: live ? toLiveMjpegUrl(id) : undefined,
        gatewayState: st?.state,
        status,
        quality: qualityFromRes(res),
        fps: st?.measured_fps || st?.source_fps || 0,
        resolution: res,
        codec: mapCodec(st?.codec ?? cam?.codec, 'H.264'),
        // Telemetry the gateway does not report yet — kept as placeholders in
        // production (never fabricated demo numbers).
        bitrateMbps: 0,
        latencyMs: 0,
        packetLoss: 0,
        uptime: '—',
        lastHeartbeat: st?.last_frame_at ? 'live' : '—',
        anprActive: false,
        aiDetection: st?.state === 'LIVE' || (st?.state ?? '').length > 0,
        detections: [],
        vehicleCount: 0,
        lastPlate: undefined,
        alertLabel: undefined,
        // Real RTSP (credentials-bearing) is NEVER sent to the browser. The
        // gateway MJPEG / HLS / WHEP endpoints above are the preview channels.
        streamUrl: '',
        events: [],
      };
    });
}

export function useGatewayLiveCameras(tick: number) {
  const [registry, setRegistry] = useState<RegistryCamera[]>([]);
  const [streams, setStreams] = useState<StreamStatusDto[]>([]);
  const [online, setOnline] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      Promise.all([
        api.getRegistryCameras().catch(() => [] as RegistryCamera[]),
        api.getStreams().catch(() => [] as StreamStatusDto[]),
      ])
        .then(([cams, sts]) => {
          if (cancelled) return;
          setRegistry(cams);
          setStreams(sts);
          setOnline(cams.length > 0 || sts.length > 0);
          setDemoActive(DEMO_MODE && cams.length === 0 && sts.length === 0);
        })
        .catch(() => {
          if (!cancelled) {
            setOnline(false);
            setDemoActive(DEMO_MODE);
          }
        });
    };
    pull();
    const id = window.setInterval(pull, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const cameras = useMemo(
    () => mergeLiveCameras(registry, streams, tick, DEMO_MODE),
    [registry, streams, tick],
  );

  const health = useMemo(() => {
    const states = { online: 0, reconnecting: 0, offline: 0, degraded: 0 };
    for (const s of streams) {
      const u = s.state.toUpperCase();
      if (u === 'LIVE') states.online += 1;
      else if (u === 'RECONNECTING' || u === 'CONNECTING') states.reconnecting += 1;
      else if (u === 'ERROR') states.degraded += 1;
      else states.offline += 1;
    }
    const live = streams.filter((s) => s.state === 'LIVE');
    const avgFps = live.length ? live.reduce((a, s) => a + (s.measured_fps || 0), 0) / live.length : 0;
    return { states, avgFps, liveCount: live.length, gatewayOnline: online };
  }, [streams, online]);

  return { cameras, health, gatewayOnline: online, demoActive };
}
