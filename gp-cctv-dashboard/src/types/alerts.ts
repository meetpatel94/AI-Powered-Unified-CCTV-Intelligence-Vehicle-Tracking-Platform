import type { LucideIcon } from 'lucide-react';

import type { AccentTone, Severity } from '@/types';

export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'escalated' | 'resolved';
export type AlertGroupId =
  | 'watchlist'
  | 'speed'
  | 'wrongdir'
  | 'redlight'
  | 'crowd'
  | 'security'
  | 'traffic'
  | 'patrol';
export type AlertKpiTone = AccentTone | 'yellow';
export type AlertEventTone = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'cyan';

/** One camera-to-camera sighting inside a reconstructed vehicle journey. */
export interface AlertJourneyStop {
  step: number;
  time: string;
  camera: string;
  road: string;
  city: string;
  thumbnail: string;
  speedKph?: number;
  heading?: string;
  alert?: boolean;
}

/** Single entry in the incident response log. `pending` rows are awaiting action. */
export interface AlertResponseEvent {
  id: string;
  label: string;
  detail: string;
  actor: string;
  time: string;
  ago: string;
  tone: AlertEventTone;
  pending?: boolean;
}

export interface AlertRecord {
  id: string;
  /** Human event type, e.g. "Watchlist Match". */
  title: string;
  /** Big mono subject line: plate, or short object descriptor for non-vehicle AI events. */
  subject: string;
  plate?: string;
  /** Make / model / year line for vehicle events. */
  objectLabel?: string;
  groupId: AlertGroupId;
  severity: Severity;
  status: AlertStatus;
  camera: string;
  location: string;
  city: string;
  zone: string;
  confidence: number;
  /** Minutes before the console reference clock (10:46:03 AM, 01 Sep 2026). */
  minutesAgo: number;
  time: string;
  ago: string;
  firstSeen?: string;
  lastSeen?: string;
  speedKph?: number;
  limitKph?: number;
  heading?: string;
  watchlistList?: string;
  caseRef?: string;
  assignedTo?: string;
  details: string;
  notes: string;
  thumbnail: string;
  /** Extra archived frames for the evidence strip in the details panel. */
  evidence: string[];
  icon: LucideIcon;
  relatedCameras: string[];
  journey: AlertJourneyStop[];
  timeline: AlertResponseEvent[];
}

export interface AlertKpi {
  id: 'total' | 'critical' | 'high' | 'medium' | 'resolved';
  label: string;
  footnote: string;
  tone: AlertKpiTone;
  icon: LucideIcon;
}

export interface ActivityEvent {
  id: string;
  time: string;
  text: string;
  plate?: string;
  camera: string;
  icon: LucideIcon;
  tone: 'info' | 'watchlist' | 'alert' | 'warning';
}

export interface AlertTypeBar {
  id: AlertGroupId;
  label: string;
  value: number;
  color: string;
}

export interface AlertTimePoint {
  label: string;
  value: number;
}

export interface TopAlertLocation {
  id: string;
  rank: number;
  name: string;
  city: string;
  alerts: number;
  peak: string;
  trend: 'up' | 'down' | 'flat';
}
