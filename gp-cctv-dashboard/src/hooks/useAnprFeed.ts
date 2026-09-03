import { useEffect, useRef, useState } from 'react';

import { anprSeed, watchlistPlates } from '@/data/liveViewData';
import { formatClock } from '@/hooks/useLiveClock';
import { createRealtimeChannel } from '@/services/realtime';
import { api, type SightingDto } from '@/services/api';
import type { AnprHit } from '@/types/liveView';

/**
 * Live ANPR OCR feed.
 *
 * Primary source is the backend Vehicle Intelligence Pipeline: it seeds from
 * `GET /api/anpr/recent` and then streams the `anpr:hit` WebSocket topic from
 * `/api/ws`. If the backend is unreachable it falls back to the bundled
 * `anprSeed` so the Gujarat Police dashboard still renders — no UI change.
 */

function timeOf(iso: string | null | undefined): string {
  if (!iso) return formatClock(new Date()).replace(/\s?[AP]M$/i, '');
  return formatClock(new Date(iso)).replace(/\s?[AP]M$/i, '');
}

function mapSighting(s: SightingDto): AnprHit {
  return {
    id: `anpr-${s.id}`,
    plate: s.plate,
    camera: s.camera_id,
    time: timeOf(s.seen_at),
    confidence: Number(((s.ocr_confidence ?? 0) * 100).toFixed(1)),
    watchlist: watchlistPlates.has(s.plate),
  };
}

export function useAnprFeed(maxRows = 14) {
  const [hits, setHits] = useState<AnprHit[]>(anprSeed);
  const liveSeen = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Seed from recent persisted ANPR reads.
    api
      .getRecentAnpr(maxRows)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        liveSeen.current = true;
        setHits(rows.map(mapSighting).slice(0, maxRows));
      })
      .catch(() => undefined);

    // Stream live hits.
    const bus = createRealtimeChannel();
    const off = bus.on('anpr:hit', (payload) => {
      const p = payload as {
        plate: string;
        camera_id: string;
        confidence: number;
        timestamp?: string;
      };
      if (!p?.plate) return;
      const hit: AnprHit = {
        id: `anpr-live-${p.plate}-${p.timestamp ?? Date.now()}`,
        plate: p.plate,
        camera: p.camera_id,
        time: timeOf(p.timestamp),
        confidence: Number(((p.confidence ?? 0) * 100).toFixed(1)),
        watchlist: watchlistPlates.has(p.plate),
      };
      if (!liveSeen.current) {
        liveSeen.current = true;
        setHits([hit]);
      } else {
        setHits((prev) => [hit, ...prev].slice(0, maxRows));
      }
    });

    return () => {
      cancelled = true;
      off();
      bus.close();
    };
  }, [maxRows]);

  return hits;
}
