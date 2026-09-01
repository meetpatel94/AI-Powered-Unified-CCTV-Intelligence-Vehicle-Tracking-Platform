import type { Severity } from '@/types';
import type { AlertEventTone, AlertStatus } from '@/types/alerts';

/* Severity presentation maps shared by the feed cards, details panel and charts. */

export const severityRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

export const severityChip: Record<Severity, string> = {
  critical: 'text-[#ff8b96] bg-accent-red/10 ring-accent-red/40',
  high: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40',
  medium: 'text-[#eddb6a] bg-accent-yellow/10 ring-accent-yellow/40',
  info: 'text-[#7db4ff] bg-accent-blue/10 ring-accent-blue/40',
};

export const severityText: Record<Severity, string> = {
  critical: 'text-[#ff8b96]',
  high: 'text-[#f7b95f]',
  medium: 'text-[#eddb6a]',
  info: 'text-[#7db4ff]',
};

export const severityBar: Record<Severity, string> = {
  critical: 'bg-accent-red shadow-[0_0_10px_-1px_rgba(239,68,68,0.85)]',
  high: 'bg-accent-orange shadow-[0_0_8px_-1px_rgba(245,158,11,0.7)]',
  medium: 'bg-accent-yellow/90',
  info: 'bg-accent-blue',
};

export const severityLabel: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
};

export const statusChip: Record<AlertStatus, string> = {
  new: 'text-[#9fc7ff] bg-accent-blue/10 ring-accent-blue/40',
  acknowledged: 'text-[#67e8f9] bg-accent-cyan/10 ring-accent-cyan/40',
  investigating: 'text-[#d0a4f7] bg-accent-purple/10 ring-accent-purple/40',
  escalated: 'text-[#f7b95f] bg-accent-orange/10 ring-accent-orange/40',
  resolved: 'text-[#6fe0b0] bg-accent-green/10 ring-accent-green/40',
};

export const statusLabel: Record<AlertStatus, string> = {
  new: 'Unreviewed',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

export const eventTone: Record<AlertEventTone, { dot: string; text: string }> = {
  red: { dot: 'bg-accent-red ring-accent-red/30', text: 'text-[#ff8b96]' },
  orange: { dot: 'bg-accent-orange ring-accent-orange/30', text: 'text-[#f7b95f]' },
  yellow: { dot: 'bg-accent-yellow ring-accent-yellow/30', text: 'text-[#eddb6a]' },
  green: { dot: 'bg-accent-green ring-accent-green/30', text: 'text-[#6fe0b0]' },
  blue: { dot: 'bg-[#5aa2ff] ring-accent-blue/30', text: 'text-[#7db4ff]' },
  purple: { dot: 'bg-accent-purple ring-accent-purple/30', text: 'text-[#d0a4f7]' },
  cyan: { dot: 'bg-accent-cyan ring-accent-cyan/30', text: 'text-[#67e8f9]' },
};
