import { useEffect, useRef, useState } from 'react';

import { anprSeed, platePool, watchlistPlates } from '@/data/liveViewData';
import { formatClock } from '@/hooks/useLiveClock';
import type { AnprHit } from '@/types/liveView';

const ANPR_CAMERAS = ['C-001', 'C-007', 'C-015', 'C-038', 'C-052', 'C-115', 'C-207'];

/**
 * Simulated ANPR OCR stream.
 *
 * Stands in for the `anpr:hit` WebSocket topic in services/realtime.ts — when the
 * gateway is live, replace the interval with `bus.on('anpr:hit', push)`.
 */
export function useAnprFeed(maxRows = 14, intervalMs = 3200) {
  const [hits, setHits] = useState<AnprHit[]>(anprSeed);
  const counter = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      counter.current += 1;
      const plate = platePool[Math.floor(Math.random() * platePool.length)];
      const camera = ANPR_CAMERAS[Math.floor(Math.random() * ANPR_CAMERAS.length)];
      const hit: AnprHit = {
        id: `live-${counter.current}-${Date.now()}`,
        plate,
        camera,
        time: formatClock(new Date()).replace(/\s?[AP]M$/i, ''),
        confidence: Number((86 + Math.random() * 13.5).toFixed(1)),
        watchlist: watchlistPlates.has(plate),
      };
      setHits((prev) => [hit, ...prev].slice(0, maxRows));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [maxRows, intervalMs]);

  return hits;
}
