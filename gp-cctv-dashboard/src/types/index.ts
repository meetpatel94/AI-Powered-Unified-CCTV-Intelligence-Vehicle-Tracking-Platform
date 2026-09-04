import type { LucideIcon } from 'lucide-react';

export type Severity = 'critical' | 'high' | 'medium' | 'info';
export type AccentTone = 'blue' | 'green' | 'orange' | 'red' | 'purple';
export type SystemState = 'operational' | 'good' | 'degraded' | 'down';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Route path; screens not built yet are marked `available: false`. */
  path: string;
  available?: boolean;
}

export interface KpiStat {
  id: string;
  label: string;
  /** Optional lighter suffix rendered next to the label, e.g. "(Today)". */
  labelSuffix?: string;
  value: string;
  footnote: string;
  trend?: 'up' | 'down';
  tone: AccentTone;
  icon: LucideIcon;
}

export interface CameraFeed {
  id: string;
  code: string;
  location: string;
  city: string;
  thumbnail: string;
  status: 'live' | 'offline' | 'poor';
  /** Placeholder for the future media source (RTSP -> HLS/WebRTC gateway). */
  streamUrl?: string;
}

export interface AlertItem {
  id: string;
  type: string;
  plate?: string;
  cameraCode: string;
  location: string;
  time: string;
  ago: string;
  severity: Severity;
  icon: LucideIcon;
}

export interface HealthSlice {
  id: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface MapCamera {
  id: string;
  x: number;
  y: number;
  state: 'online' | 'warning' | 'critical' | 'offline';
}

export interface RoutePoint {
  step: number;
  x: number;
  y: number;
  cameraCode: string;
  critical?: boolean;
}

export interface MapLabel {
  text: string;
  x: number;
  y: number;
  size: 'city' | 'town' | 'area' | 'road';
  rotate?: number;
}

export interface JourneyStop {
  step: number;
  time: string;
  cameraCode: string;
  road: string;
  city: string;
  thumbnail: string;
  alert?: boolean;
}

export interface VehicleRecord {
  plate: string;
  type: string;
  color: string;
  firstSeen: string;
  lastSeen: string;
  snapshot: string;
  watchlistMatch: boolean;
}

export interface AnalyticsBar {
  id: string;
  label: string;
  value: number;
  color: string;
  glow: string;
}

export interface SystemStatusItem {
  label: string;
  value: string;
  state: SystemState;
}
