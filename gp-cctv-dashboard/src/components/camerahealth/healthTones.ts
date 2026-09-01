import type { MetricTone } from '@/types/cameraHealth';

/** Shared tone vocabulary for the health console (green / amber / red / cyan). */
export const toneHex: Record<MetricTone, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#2f7dff',
};

export const toneInk: Record<MetricTone, string> = {
  green: '#6fe0b0',
  amber: '#f7b95f',
  red: '#ff8b96',
  cyan: '#9fc7ff',
};

export const toneChip: Record<MetricTone, string> = {
  green: 'border-accent-green/45 bg-[#0b2e26] text-[#6fe0b0]',
  amber: 'border-accent-orange/45 bg-[#2b1a06] text-[#f7b95f]',
  red: 'border-accent-red/45 bg-[#2b0b10] text-[#ff8b96]',
  cyan: 'border-accent-blue/45 bg-[#12233f] text-[#9fc7ff]',
};

export const toneDot: Record<MetricTone, string> = {
  green: 'bg-accent-green',
  amber: 'bg-accent-orange',
  red: 'bg-accent-red',
  cyan: 'bg-accent-blue',
};

export const toneGlow: Record<MetricTone, string> = {
  green: 'shadow-[0_0_10px_-2px_rgba(34,197,94,0.75)]',
  amber: 'shadow-[0_0_10px_-2px_rgba(245,158,11,0.75)]',
  red: 'shadow-[0_0_10px_-2px_rgba(239,68,68,0.75)]',
  cyan: 'shadow-[0_0_10px_-2px_rgba(47,125,255,0.75)]',
};
