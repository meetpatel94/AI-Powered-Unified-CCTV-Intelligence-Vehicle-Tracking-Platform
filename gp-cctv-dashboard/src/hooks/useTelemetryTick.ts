import { useEffect, useState } from 'react';

/**
 * Small deterministic-ish jitter source so FPS / latency / bitrate readouts
 * drift like a real telemetry stream instead of sitting frozen.
 * Replace with `kpi:tick` WebSocket frames later.
 */
export function useTelemetryTick(intervalMs = 2000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return tick;
}

/** Stable per-key pseudo random in [0,1) that changes with the tick. */
export function jitter(key: string, tick: number): number {
  let h = 2166136261;
  const str = `${key}:${tick}`;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Jitters a base value by +/- `spread`, rounded to `decimals`. */
export function drift(base: number, spread: number, key: string, tick: number, decimals = 0): number {
  const value = base + (jitter(key, tick) - 0.5) * 2 * spread;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
