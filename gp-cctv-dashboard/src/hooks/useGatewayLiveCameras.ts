import { useEffect, useMemo, useState } from 'react';

import { liveCameras } from '@/data/liveViewData';
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

export function mergeLiveCameras(
  registry: RegistryCamera[],
  streams: StreamStatusDto[],
  tick: number,
): LiveCamera[] {
  const byId = new Map(streams.map((s) => [s.camera_id, s]));
  const mockById = new Map(liveCameras.map((c) => [c.id, c]));

  if (!registry.length && !streams.length) return liveCameras;

  const ids = new Set<string>([
    ...registry.map((c) => c.camera_id),
    ...streams.map((s) => s.camera_id),
  ]);

  return [...ids].sort().map((id) => {
    const cam = registry.find((c) => c.camera_id === id);
    const st = byId.get(id);
    const mock = mockById.get(id);
    const loc = splitLocation(cam?.location_name ?? mock?.location ?? id);
    const live = st && ['LIVE', 'RECONNECTING', 'CONNECTING'].includes(st.state);
    const res = st?.resolution || cam?.resolution || mock?.resolution || '1920x1080';
    return {
      id,
      location: loc.location,
      city: mock?.city ?? loc.city,
      zone: mock?.zone ?? cam?.department ?? 'Command',
      department: cam?.department ?? mock?.department ?? 'Gujarat Police',
      thumbnail: live ? toLiveMjpegUrl(id) : (mock?.thumbnail ?? toLiveFrameUrl(id, tick)),
      liveFrameUrl: live ? toLiveMjpegUrl(id) : undefined,
      gatewayState: st?.state,
      status: mapState(st?.state, mock?.status ?? 'offline'),
      quality: qualityFromRes(res),
      fps: st?.measured_fps || st?.source_fps || mock?.fps || 0,
      resolution: res,
      codec: mapCodec(st?.codec ?? cam?.codec, mock?.codec ?? 'H.264'),
      bitrateMbps: mock?.bitrateMbps ?? 0,
      latencyMs: mock?.latencyMs ?? 0,
      packetLoss: mock?.packetLoss ?? 0,
      uptime: mock?.uptime ?? '—',
      lastHeartbeat: st?.last_frame_at ? 'live' : (mock?.lastHeartbeat ?? '—'),
      anprActive: mock?.anprActive ?? false,
      aiDetection: mock?.aiDetection ?? false,
      detections: mock?.detections ?? [],
      vehicleCount: mock?.vehicleCount ?? 0,
      lastPlate: mock?.lastPlate,
      alertLabel: mock?.alertLabel,
      // The real stream URL is secret-bearing and never sent to the browser;
      // show a capability label instead (mock feeds keep their demo string).
      streamUrl: cam ? (cam.rtsp_configured ? 'rtsp://secured-stream' : '') : (mock?.streamUrl ?? ''),
      events: mock?.events ?? [],
    };
  });
}

export function useGatewayLiveCameras(tick: number) {
  const [registry, setRegistry] = useState<RegistryCamera[]>([]);
  const [streams, setStreams] = useState<StreamStatusDto[]>([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      Promise.all([api.getRegistryCameras().catch(() => [] as RegistryCamera[]), api.getStreams().catch(() => [] as StreamStatusDto[])])
        .then(([cams, sts]) => {
          if (cancelled) return;
          setRegistry(cams);
          setStreams(sts);
          setOnline(cams.length > 0 || sts.length > 0);
        })
        .catch(() => {
          if (!cancelled) setOnline(false);
        });
    };
    pull();
    const id = window.setInterval(pull, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const cameras = useMemo(() => mergeLiveCameras(registry, streams, tick), [registry, streams, tick]);

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

  return { cameras, health, gatewayOnline: online };
}
