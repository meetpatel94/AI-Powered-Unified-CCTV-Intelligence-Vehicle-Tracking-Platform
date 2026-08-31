import type { LucideIcon } from 'lucide-react';

import type { AccentTone } from '@/types';

export type WatchlistType = 'vehicle' | 'person' | 'other';
export type EntryStatus = 'active' | 'monitoring' | 'inactive';
export type EntryPriority = 'critical' | 'high' | 'medium' | 'low';
export type CategoryTone = AccentTone | 'cyan';

export interface WatchlistCategory {
  id: string;
  name: string;
  type: WatchlistType;
  entries: number;
  activeAlerts: number;
  updated: string;
  tone: CategoryTone;
  icon: LucideIcon;
}

export interface WatchlistMatchEvent {
  time: string;
  ago: string;
  camera: string;
  location: string;
  confidence: number;
}

export interface WatchlistEntry {
  id: string;
  type: WatchlistType;
  /** Plate number for vehicles / full name for persons / descriptor otherwise. */
  label: string;
  alias?: string;
  details: string;
  categoryId: string;
  status: EntryStatus;
  priority: EntryPriority;
  addedOn: string;
  /** Numeric keys used for sorting (higher = more recent). */
  addedTs: number;
  lastMatchTs: number;
  addedBy: string;
  matches: number;
  thumbnail?: string;
  notes: string;
  matchingCameras: string[];
  latestMatch?: WatchlistMatchEvent;
  history: WatchlistMatchEvent[];
}

export interface WatchlistKpi {
  id: string;
  label: string;
  value: string;
  footnote: string;
  tone: AccentTone;
  icon: LucideIcon;
}

export interface WatchlistAlertItem {
  id: string;
  title: string;
  label?: string;
  camera: string;
  location: string;
  time: string;
  ago: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  icon: LucideIcon;
}

export interface WatchlistSummarySlice {
  id: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface AlertsByWatchlistBar {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface MatchesPoint {
  day: string;
  value: number;
}

export interface TopLocation {
  id: string;
  rank: number;
  name: string;
  city: string;
  matches: number;
  trend: 'up' | 'down' | 'flat';
}
