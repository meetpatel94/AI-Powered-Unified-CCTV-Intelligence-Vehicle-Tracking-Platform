import { useEffect, useState } from 'react';

/** Formats a Date as the HH:MM:SS AM/PM strings used across the console. */
export function formatClock(date: Date): string {
  return date
    .toLocaleTimeString('en-IN', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .toUpperCase();
}

/** Ticking wall-clock used for the live overlay timestamps. */
export function useLiveClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
