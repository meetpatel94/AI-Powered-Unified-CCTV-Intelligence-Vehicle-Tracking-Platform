/* ------------------------------------------------------------------ *
 * SYSTEM SETTINGS — domain types
 *
 * Frontend mock-data only, but the shapes are deliberately aligned with
 * the future backend services:
 *   · SystemConfig            → `PATCH /api/v1/settings/{group}` JSON body
 *   · SettingAuditEntry       → `GET /api/v1/audit?module=settings`
 *   · ChangeHistoryEntry      → `GET /api/v1/settings/changelog`
 *   · SystemRuntimeStatus     → `/ws` status frames + `/api/v1/system/status`
 *   · MaintenanceAction       → `POST /api/v1/maintenance/{action}`
 *
 * Values are kept to plain JSON primitives (string | number | boolean |
 * string[]) so the whole configuration snapshot can be deep-compared,
 * serialised and later exchanged with an API without any transformation.
 * ------------------------------------------------------------------ */

import type { LucideIcon } from 'lucide-react';

/** The fourteen control areas exposed in the settings workspace. */
export type SettingsSectionId =
  | 'general'
  | 'cameras'
  | 'ai'
  | 'anpr'
  | 'tracking'
  | 'watchlist'
  | 'gis'
  | 'notifications'
  | 'users'
  | 'storage'
  | 'performance'
  | 'security'
  | 'audit'
  | 'maintenance';

/** Primitive values stored in the configuration tree. */
export type SettingValue = string | number | boolean | string[];

/** `"group.field"` path into SystemConfig, e.g. "cameras.rtspTimeoutSec". */
export type SettingPath = string;

/* ------------------------------------------------------------------ *
 * General
 * ------------------------------------------------------------------ */

export interface GeneralConfig {
  platformName: string;
  commandLocation: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  autoRefreshSec: number;
  theme: 'navy' | 'midnight' | 'contrast';
}

/* ------------------------------------------------------------------ *
 * Camera & Streams
 * ------------------------------------------------------------------ */

export interface CameraStreamsConfig {
  rtspTimeoutSec: number;
  reconnectAttempts: number;
  exponentialBackoff: boolean;
  maxConcurrentStreams: number;
  defaultProtocol: 'TCP' | 'UDP' | 'Auto';
  h264Support: boolean;
  h265Support: boolean;
  webrtcPreview: boolean;
  hlsFallback: boolean;
  defaultResolution: string;
  targetFps: number;
}

/* ------------------------------------------------------------------ *
 * AI Detection
 * ------------------------------------------------------------------ */

export interface AiDetectionConfig {
  vehicleDetectionEnabled: boolean;
  confidenceMin: number;
  classes: string[];
  inferenceFps: number;
  computeMode: 'gpu' | 'cpu' | 'auto';
  processingInterval: string;
}

/* ------------------------------------------------------------------ *
 * ANPR & OCR
 * ------------------------------------------------------------------ */

export interface AnprOcrConfig {
  anprEnabled: boolean;
  ocrConfidenceMin: number;
  plateFormats: string[];
  recognitionFrequency: string;
  duplicateSuppression: boolean;
  duplicateWindowSec: number;
  lowConfidenceHandling: string;
}

/* ------------------------------------------------------------------ *
 * Tracking
 * ------------------------------------------------------------------ */

export interface TrackingConfig {
  trackingEnabled: boolean;
  crossCameraMatching: boolean;
  trackerSensitivity: number;
  maxTrackingGapSec: number;
  journeyHistory: string;
  reidConfidenceMin: number;
  storeSnapshots: boolean;
}

/* ------------------------------------------------------------------ *
 * Watchlist & Alerts
 * ------------------------------------------------------------------ */

export interface WatchlistAlertsConfig {
  realtimeMatching: boolean;
  criticalThresholdPerMin: number;
  priorityLevels: string[];
  soundAlert: boolean;
  autoEscalation: string;
  alertRetentionDays: number;
  watchlistAutoSync: boolean;
  syncIntervalMin: number;
}

/* ------------------------------------------------------------------ *
 * GIS & Maps
/* ------------------------------------------------------------------ */

export interface GisMapsConfig {
  mapCenter: string;
  zoomLevel: number;
  layers: string[];
  markerClustering: boolean;
  routeDisplay: boolean;
  liveVehicleTracking: boolean;
  trackRefreshSec: number;
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

export interface NotificationsConfig {
  browserNotifications: boolean;
  dashboardAlerts: boolean;
  emailNotify: string;
  smsNotify: string;
  severities: string[];
  soundEnabled: boolean;
  soundTone: string;
  volume: number;
}

/* ------------------------------------------------------------------ *
 * Users & Roles (RBAC)
 * ------------------------------------------------------------------ */

export type SettingsRoleId =
  | 'super-admin'
  | 'command-inspector'
  | 'investigation-officer'
  | 'control-operator'
  | 'traffic-analyst'
  | 'viewer';

export type SettingsPermissionKey =
  | 'platform-settings'
  | 'user-management'
  | 'watchlist-edits'
  | 'alerts-dispatch'
  | 'camera-admin'
  | 'reports-export';

export interface UsersRolesConfig {
  rbacEnforced: boolean;
  sessionTimeoutMin: number;
  idleLockMin: number;
  passwordPolicy: string;
  passwordExpiryDays: number;
  mfaRequired: boolean;
  lockoutAttempts: number;
  lockoutDurationMin: number;
  defaultRole: string;
  rolePermissions: Record<SettingsRoleId, Record<SettingsPermissionKey, boolean>>;
}

/* ------------------------------------------------------------------ *
 * Storage & Retention
 * ------------------------------------------------------------------ */

export interface StorageRetentionConfig {
  evidenceRetentionDays: number;
  snapshotRetentionDays: number;
  videoRetentionDays: number;
  metadataRetention: string;
  automaticCleanup: boolean;
  cleanupWindow: string;
  storageWarningPct: number;
  compressArchive: boolean;
}

/* ------------------------------------------------------------------ *
 * Performance thresholds
 * ------------------------------------------------------------------ */

export interface PerformanceConfig {
  cpuWarnPct: number;
  cpuCritPct: number;
  ramWarnPct: number;
  inferenceLatencyWarnMs: number;
  streamCapacityWarnPct: number;
  telemetryIntervalSec: number;
}

/* ------------------------------------------------------------------ *
 * Security
 * ------------------------------------------------------------------ */

export interface SecurityConfig {
  secureSessionOnly: boolean;
  apiAccessLevel: string;
  auditLogging: boolean;
  loginProtection: boolean;
  suspiciousAccessDetection: boolean;
  suspiciousThreshold: string;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  restrictWorkstations: boolean;
}

/* ------------------------------------------------------------------ *
 * Audit log policy
 * ------------------------------------------------------------------ */

export interface AuditLogsConfig {
  recordLevel: string;
  retentionDays: number;
  tamperEvidentHashing: boolean;
  includePayloads: boolean;
}

/* ------------------------------------------------------------------ *
 * System Maintenance
 * ------------------------------------------------------------------ */

export type MaintenanceActionId =
  | 'backup'
  | 'clear-cache'
  | 'rebuild-index'
  | 'restart-ai'
  | 'restart-gateway'
  | 'test-cameras';

export interface MaintenanceConfig {
  maintenanceMode: boolean;
  maintenanceWindow: string;
  autoRestartPolicy: string;
  notifyOnCompletion: boolean;
}

/* ------------------------------------------------------------------ *
 * Root configuration tree
 * ------------------------------------------------------------------ */

export interface SystemConfig {
  general: GeneralConfig;
  cameras: CameraStreamsConfig;
  ai: AiDetectionConfig;
  anpr: AnprOcrConfig;
  tracking: TrackingConfig;
  watchlist: WatchlistAlertsConfig;
  gis: GisMapsConfig;
  notifications: NotificationsConfig;
  users: UsersRolesConfig;
  storage: StorageRetentionConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  audit: AuditLogsConfig;
  maintenance: MaintenanceConfig;
}

/** Optional constraint meta for numeric fields (single source of truth). */
export interface NumericMeta {
  min: number;
  max: number;
  step: number;
  unit?: string;
  integer?: boolean;
}

/* ------------------------------------------------------------------ *
 * Audit log + change history + runtime status
 * ------------------------------------------------------------------ */

export type AuditStatus = 'success' | 'failed' | 'blocked' | 'warning';
export type AuditActionKind =
  | 'login'
  | 'logout'
  | 'config'
  | 'security'
  | 'maintenance'
  | 'export'
  | 'user-admin';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  actionKind: AuditActionKind;
  module: string;
  ip: string;
  status: AuditStatus;
  detail: string;
}

export type HistorySource = 'saved' | 'applied' | 'maintenance';

export interface ChangeHistoryEntry {
  id: string;
  path: SettingPath;
  settingLabel: string;
  previous: string;
  next: string;
  changedBy: string;
  timestamp: string;
  source: HistorySource;
  status: 'Saved' | 'Applied' | 'Live';
}

/** Runtime readout shown in the right SYSTEM STATUS rail. */
export interface RuntimeStatusItem {
  id: string;
  label: string;
  sublabel: string;
  state: 'operational' | 'good' | 'degraded' | 'down';
  badge: string;
  readout: string;
  icon: LucideIcon;
}

/** One maintenance action tile in the System Maintenance section. */
export interface MaintenanceActionDef {
  id: MaintenanceActionId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: 'danger' | 'warn' | 'primary' | 'neutral';
  destructive: boolean;
  lastRun: string;
  durationHint: string;
}

/** Declarative description of a settings section (nav + panel + scrollspy). */
export interface SettingsSectionMeta {
  id: SettingsSectionId;
  label: string;
  shortLabel: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind classes for the section identity tile. */
  accentChip: string;
  accentBar: string;
  iconColor: string;
}
