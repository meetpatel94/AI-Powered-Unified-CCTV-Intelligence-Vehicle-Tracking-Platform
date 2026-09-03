import { useEffect, useRef, useState } from 'react';

import { DEMO_MODE } from '@/config';
import { anprSeed, watchlistPlates } from '@/data/liveViewData';
import { formatClock } from '@/hooks/useLiveClock';
import { api, type SightingDto } from '@/services/api';
import { createRealtimeChannel } from '@/services/realtime';
import type { AnprHit } from '@/types/liveView';

/**
 * Live ANPR OCR feed.
 *
 * Primary source is the backend Vehicle Intelligence Pipeline: it seeds from
 * `GET /api/anpr/recent` and then streams the `anpr:hit` WebSocket topic from
 * `/api/ws`. The `watchlist` flag on each hit is derived ONLY from genuine
 * active watchlist entries returned by the backend — never from a hard-coded
 * list. Demo fixtures are shown only when `VITE_DEMO_MODE=true`; otherwise an
 * unreachable backend yields an empty, offline feed (never fabricated hits).
 */

function timeOf(iso: string | null | undefined): string {
  if (!iso) return formatClock(new Date()).replace(/\s?[AP]M$/i, '');
  return formatClock(new Date(iso)).replace(/\s?[AP]M$/i, '');
}

interface RealtimeAnprFrame {
  plate: string;
  camera_id: string;
  confidence?: number;
  timestamp?: string;
  synthetic?: boolean;
  /** True when the OCR read is not grammar-valid / below reliability threshold. */
  uncertain?: boolean;
}

export interface AnprFeedState {
  hits: AnprHit[];
  live: boolean;
  demo: boolean;
}

export function useAnprFeed(maxRows = 14): AnprFeedState {
  // Production starts empty; demo seeds are shown only in VITE_DEMO_MODE=true.
  const [hits, setHits] = useState<AnprHit[]>(() => (DEMO_MODE ? anprSeed : []));
  const [live, setLive] = useState(false);
  const liveSeen = useRef(false);

  // Genuine active-watchlist plates (backend-driven — never a hard-coded list).
  const watchlistRef = useRef<Set<string>>(new Set(DEMO_MODE ? [...watchlistPlates] : []));
  const isWatchlist = (plate: string): boolean => watchlistRef.current.has(plate);

  useEffect(() => {
    let cancelled = false;

    // Load the real set of active watchlist plates for honest flags.
    api
      .getWatchlist({ is_active: true, limit: 500 })
      .then((page) => {
        const plates = new Set<string>();
        for (const entry of page.items) {
          if (entry.is_active && entry.plate) plates.add(entry.plate);
        }
        if (plates.size) watchlistRef.current = plates;
      })
      .catch(() => undefined);

    // Seed from recent persisted ANPR reads.
    api
      .getRecentAnpr(maxRows)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        liveSeen.current = true;
        setLive(true);
        setHits(
          rows
            .map((s) => ({ s, w: isWatchlist(s.plate) }))
            .map(({ s, w }) => ({ ...mapSighting(s), watchlist: w }))
            .slice(0, maxRows),
        );
      })
      .catch(() => undefined);

    // Stream genuine live hits.
    const bus = createRealtimeChannel();
    const off = bus.on('anpr:hit', (payload) => {
      const p = payload as RealtimeAnprFrame;
      if (!p?.plate) return;
      // Synthetic (dev-only random-weight) detections and uncertain OCR reads
      // must not appear as confirmed plate reads in production.
      if ((p.synthetic || p.uncertain) && !DEMO_MODE) return;
      const hit: AnprHit = {
        id: `anpr-live-${p.plate}-${p.timestamp ?? Date.now()}`,
        plate: p.plate,
        camera: p.camera_id,
        time: timeOf(p.timestamp),
        confidence: Number(((p.confidence ?? 0) * 100).toFixed(1)),
        watchlist: isWatchlist(p.plate),
      };
      if (!liveSeen.current) {
        liveSeen.current = true;
        setLive(true);
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

  return { hits, live, demo: DEMO_MODE };
}

function mapSighting(s: SightingDto): AnprHit {
  return {
    id: `anpr-${s.id}`,
    plate: s.plate,
    camera: s.camera_id,
    time: timeOf(s.seen_at),
    confidence: Number(((s.ocr_confidence ?? 0) * 100).toFixed(1)),
    watchlist: false, // resolved by the caller against the real watchlist set
  };
}
