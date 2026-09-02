import {
  Activity,
  Bell,
  BrainCircuit,
  Cctv,
  Camera,
  CloudUpload,
  Database,
  HardDrive,
  Lock,
  Map,
  Radio,
  RotateCw,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Waypoints,
  Wrench,
  Wifi,
} from 'lucide-react';

import type {
  AuditLogEntry,
  AuditStatus,
  ChangeHistoryEntry,
  MaintenanceActionDef,
  NumericMeta,
  RuntimeStatusItem,
  SettingPath,
  SettingsPermissionKey,
  SettingsRoleId,
  SettingsSectionId,
  SettingsSectionMeta,
  SystemConfig,
} from '@/types/settings';

/* ------------------------------------------------------------------ *
 * Section catalogue — drives the left navigation, scrollspy and the
 * per-section panels. Accent tones stay inside the console palette.
 * ------------------------------------------------------------------ */

export const SECTION_ORDER: SettingsSectionId[] = [
  'general',
  'cameras',
  'ai',
  'anpr',
  'tracking',
  'watchlist',
  'gis',
  'notifications',
  'users',
  'storage',
  'performance',
  'security',
  'audit',
  'maintenance',
];

export const SECTION_META: Record<SettingsSectionId, SettingsSectionMeta> = {
  general: {
    id: 'general',
    label: 'General',
    shortLabel: 'General',
    blurb: 'Identity, locale, refresh cadence and console theme',
    icon: SlidersHorizontal,
    accentChip: 'border-accent-blue/40 bg-accent-blue/15',
    accentBar: 'bg-accent-blue',
    iconColor: 'text-accent-blue',
  },
  cameras: {
    id: 'cameras',
    label: 'Camera & Streams',
    shortLabel: 'Cameras',
    blurb: 'RTSP ingest, codecs and transport fallback for the 12,842-camera fleet',
    icon: Cctv,
    accentChip: 'border-accent-cyan/40 bg-accent-cyan/12',
    accentBar: 'bg-accent-cyan',
    iconColor: 'text-accent-cyan',
  },
  ai: {
    id: 'ai',
    label: 'AI Detection',
    shortLabel: 'AI Detection',
    blurb: 'Vehicle inference engine, confidence floor and compute mode',
    icon: BrainCircuit,
    accentChip: 'border-[#818cf8]/40 bg-[#818cf8]/12',
    accentBar: 'bg-[#818cf8]',
    iconColor: 'text-[#a5b4fc]',
  },
  anpr: {
    id: 'anpr',
    label: 'ANPR & OCR',
    shortLabel: 'ANPR & OCR',
    blurb: 'Number-plate recognition, OCR confidence and duplicate handling',
    icon: ShieldCheck,
    accentChip: 'border-accent-purple/40 bg-accent-purple/12',
    accentBar: 'bg-accent-purple',
    iconColor: 'text-accent-purple',
  },
  tracking: {
    id: 'tracking',
    label: 'Tracking',
    shortLabel: 'Tracking',
    blurb: 'Cross-camera journey reconstruction and track continuity',
    icon: Waypoints,
    accentChip: 'border-[#34d399]/40 bg-[#34d399]/12',
    accentBar: 'bg-[#34d399]',
    iconColor: 'text-[#6ee7b7]',
  },
  watchlist: {
    id: 'watchlist',
    label: 'Watchlist & Alerts',
    shortLabel: 'Watchlist',
    blurb: 'Real-time matching, escalation and alert lifecycle policy',
    icon: ShieldAlert,
    accentChip: 'border-accent-orange/40 bg-accent-orange/12',
    accentBar: 'bg-accent-orange',
    iconColor: 'text-[#fbbf24]',
  },
  gis: {
    id: 'gis',
    label: 'GIS & Maps',
    shortLabel: 'GIS & Maps',
    blurb: 'Command map viewport, layers and live vehicle overlay',
    icon: Map,
    accentChip: 'border-[#2dd4bf]/40 bg-[#2dd4bf]/12',
    accentBar: 'bg-[#2dd4bf]',
    iconColor: 'text-[#5eead4]',
  },
  notifications: {
    id: 'notifications',
    label: 'Notifications',
    shortLabel: 'Notifications',
    blurb: 'Dispatch channels, severity routing and audible tones',
    icon: Bell,
    accentChip: 'border-accent-blue/40 bg-accent-blue/15',
    accentBar: 'bg-accent-blue',
    iconColor: 'text-[#7cb4ff]',
  },
  users: {
    id: 'users',
    label: 'Users & Roles',
    shortLabel: 'Users & Roles',
    blurb: 'RBAC matrix, session policy, MFA and account lockout',
    icon: UserCog,
    accentChip: 'border-accent-purple/40 bg-accent-purple/12',
    accentBar: 'bg-accent-purple',
    iconColor: 'text-[#c084fc]',
  },
  storage: {
    id: 'storage',
    label: 'Storage & Retention',
    shortLabel: 'Storage',
    blurb: 'Evidence archive, retention schedules and capacity headroom',
    icon: HardDrive,
    accentChip: 'border-[#60a5fa]/40 bg-[#60a5fa]/12',
    accentBar: 'bg-[#60a5fa]',
    iconColor: 'text-[#93c5fd]',
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    shortLabel: 'Performance',
    blurb: 'Compute, memory and stream telemetry with alert thresholds',
    icon: Activity,
    accentChip: 'border-[#34d399]/40 bg-[#34d399]/12',
    accentBar: 'bg-[#34d399]',
    iconColor: 'text-[#6ee7b7]',
  },
  security: {
    id: 'security',
    label: 'Security',
    shortLabel: 'Security',
    blurb: 'Transport security, encryption posture and access defence',
    icon: Lock,
    accentChip: 'border-accent-red/40 bg-accent-red/12',
    accentBar: 'bg-accent-red',
    iconColor: 'text-[#f87171]',
  },
  audit: {
    id: 'audit',
    label: 'Audit Logs',
    shortLabel: 'Audit Logs',
    blurb: 'Tamper-evident activity ledger with full-text search',
    icon: ScrollText,
    accentChip: 'border-[#38bdf8]/40 bg-[#38bdf8]/12',
    accentBar: 'bg-[#38bdf8]',
    iconColor: 'text-[#7dd3fc]',
  },
  maintenance: {
    id: 'maintenance',
    label: 'System Maintenance',
    shortLabel: 'Maintenance',
    blurb: 'Backups, caches, engine restarts and controlled downtime',
    icon: Wrench,
    accentChip: 'border-[#f59e0b]/40 bg-[#f59e0b]/12',
    accentBar: 'bg-[#f59e0b]',
    iconColor: 'text-[#fbbf24]',
  },
};

/* ------------------------------------------------------------------ *
 * Default configuration snapshot — mirrors what the platform would
 * return from GET /api/v1/settings.
 * ------------------------------------------------------------------ */

export const DEFAULT_CONFIG: SystemConfig = {
  general: {
    platformName: 'Unified AI CCTV Intelligence Platform',
    commandLocation: 'Gandhinagar State Command Centre',
    timezone: 'Asia/Kolkata (GMT+5:30)',
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12-hour (HH:MM:SS AM/PM)',
    autoRefreshSec: 5,
    theme: 'navy',
  },
  cameras: {
    rtspTimeoutSec: 10,
    reconnectAttempts: 5,
    exponentialBackoff: true,
    maxConcurrentStreams: 512,
    defaultProtocol: 'TCP',
    h264Support: true,
    h265Support: true,
    webrtcPreview: true,
    hlsFallback: true,
    defaultResolution: '1080p',
    targetFps: 25,
  },
  ai: {
    vehicleDetectionEnabled: true,
    confidenceMin: 85,
    classes: ['car', 'truck', 'bus', 'two-wheeler', 'auto-rickshaw', 'pedestrian'],
    inferenceFps: 30,
    computeMode: 'gpu',
    processingInterval: 'every-frame',
  },
  anpr: {
    anprEnabled: true,
    ocrConfidenceMin: 88,
    plateFormats: ['gj-standard', 'gj-long', 'bh-series'],
    recognitionFrequency: 'continuous',
    duplicateSuppression: true,
    duplicateWindowSec: 30,
    lowConfidenceHandling: 'review-queue',
  },
  tracking: {
    trackingEnabled: true,
    crossCameraMatching: true,
    trackerSensitivity: 65,
    maxTrackingGapSec: 45,
    journeyHistory: '7d',
    reidConfidenceMin: 70,
    storeSnapshots: true,
  },
  watchlist: {
    realtimeMatching: true,
    criticalThresholdPerMin: 3,
    priorityLevels: ['critical', 'high', 'medium'],
    soundAlert: true,
    autoEscalation: '5-min',
    alertRetentionDays: 90,
    watchlistAutoSync: true,
    syncIntervalMin: 60,
  },
  gis: {
    mapCenter: 'Gandhinagar · 23.2156° N, 72.6369° E',
    zoomLevel: 11,
    layers: ['streets', 'satellite'],
    markerClustering: true,
    routeDisplay: true,
    liveVehicleTracking: true,
    trackRefreshSec: 2,
  },
  notifications: {
    browserNotifications: true,
    dashboardAlerts: true,
    emailNotify: 'critical-high',
    smsNotify: 'critical',
    severities: ['critical', 'high'],
    soundEnabled: true,
    soundTone: 'command-chime',
    volume: 70,
  },
  users: {
    rbacEnforced: true,
    sessionTimeoutMin: 30,
    idleLockMin: 15,
    passwordPolicy: 'strong',
    passwordExpiryDays: 90,
    mfaRequired: true,
    lockoutAttempts: 5,
    lockoutDurationMin: 30,
    defaultRole: 'control-operator',
    rolePermissions: {
      'super-admin': {
        'platform-settings': true,
        'user-management': true,
        'watchlist-edits': true,
        'alerts-dispatch': true,
        'camera-admin': true,
        'reports-export': true,
      },
      'command-inspector': {
        'platform-settings': true,
        'user-management': true,
        'watchlist-edits': true,
        'alerts-dispatch': true,
        'camera-admin': false,
        'reports-export': true,
      },
      'investigation-officer': {
        'platform-settings': false,
        'user-management': false,
        'watchlist-edits': true,
        'alerts-dispatch': true,
        'camera-admin': false,
        'reports-export': true,
      },
      'control-operator': {
        'platform-settings': false,
        'user-management': false,
        'watchlist-edits': true,
        'alerts-dispatch': true,
        'camera-admin': false,
        'reports-export': false,
      },
      'traffic-analyst': {
        'platform-settings': false,
        'user-management': false,
        'watchlist-edits': false,
        'alerts-dispatch': false,
        'camera-admin': false,
        'reports-export': true,
      },
      viewer: {
        'platform-settings': false,
        'user-management': false,
        'watchlist-edits': false,
        'alerts-dispatch': false,
        'camera-admin': false,
        'reports-export': false,
      },
    },
  },
  storage: {
    evidenceRetentionDays: 180,
    snapshotRetentionDays: 14,
    videoRetentionDays: 30,
    metadataRetention: '2y',
    automaticCleanup: true,
    cleanupWindow: '02:00 IST',
    storageWarningPct: 80,
    compressArchive: true,
  },
  performance: {
    cpuWarnPct: 75,
    cpuCritPct: 90,
    ramWarnPct: 85,
    inferenceLatencyWarnMs: 250,
    streamCapacityWarnPct: 80,
    telemetryIntervalSec: 2,
  },
  security: {
    secureSessionOnly: true,
    apiAccessLevel: 'internal',
    auditLogging: true,
    loginProtection: true,
    suspiciousAccessDetection: true,
    suspiciousThreshold: '3-failures',
    encryptionAtRest: true,
    encryptionInTransit: true,
    restrictWorkstations: true,
  },
  audit: {
    recordLevel: 'security-config',
    retentionDays: 365,
    tamperEvidentHashing: true,
    includePayloads: true,
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceWindow: '02:00–03:00 IST',
    autoRestartPolicy: 'critical-failure',
    notifyOnCompletion: true,
  },
};

/* ------------------------------------------------------------------ *
 * Numeric registry — every number stored in the config carries its
 * bounds/step/unit here so validation, sliders, number fields and the
 * change-history formatter all read one source of truth.
 * ------------------------------------------------------------------ */

export const NUMERIC_META: Partial<Record<SettingPath, NumericMeta>> = {
  'general.autoRefreshSec': { min: 1, max: 60, step: 1, unit: 's' },
  'cameras.rtspTimeoutSec': { min: 3, max: 120, step: 1, unit: 's' },
  'cameras.reconnectAttempts': { min: 0, max: 20, step: 1, unit: 'tries' },
  'cameras.maxConcurrentStreams': { min: 8, max: 4096, step: 8, unit: 'sessions' },
  'ai.confidenceMin': { min: 50, max: 99, step: 1, unit: '%' },
  'anpr.ocrConfidenceMin': { min: 60, max: 99, step: 1, unit: '%' },
  'anpr.duplicateWindowSec': { min: 5, max: 300, step: 5, unit: 's' },
  'tracking.trackerSensitivity': { min: 1, max: 100, step: 1 },
  'tracking.maxTrackingGapSec': { min: 5, max: 300, step: 5, unit: 's' },
  'tracking.reidConfidenceMin': { min: 40, max: 99, step: 1, unit: '%' },
  'watchlist.criticalThresholdPerMin': { min: 1, max: 20, step: 1, unit: '/min' },
  'watchlist.alertRetentionDays': { min: 7, max: 365, step: 1, unit: 'days' },
  'gis.zoomLevel': { min: 4, max: 18, step: 1 },
  'notifications.volume': { min: 0, max: 100, step: 5, unit: '%' },
  'users.sessionTimeoutMin': { min: 5, max: 240, step: 5, unit: 'min' },
  'users.idleLockMin': { min: 1, max: 120, step: 1, unit: 'min' },
  'users.passwordExpiryDays': { min: 30, max: 365, step: 30, unit: 'days' },
  'users.lockoutDurationMin': { min: 5, max: 240, step: 5, unit: 'min' },
  'storage.evidenceRetentionDays': { min: 30, max: 1095, step: 30, unit: 'days' },
  'storage.snapshotRetentionDays': { min: 1, max: 90, step: 1, unit: 'days' },
  'storage.videoRetentionDays': { min: 1, max: 365, step: 1, unit: 'days' },
  'storage.storageWarningPct': { min: 50, max: 95, step: 1, unit: '%' },
  'performance.cpuWarnPct': { min: 40, max: 95, step: 1, unit: '%' },
  'performance.cpuCritPct': { min: 60, max: 99, step: 1, unit: '%' },
  'performance.ramWarnPct': { min: 40, max: 98, step: 1, unit: '%' },
  'performance.inferenceLatencyWarnMs': { min: 50, max: 2000, step: 10, unit: 'ms' },
  'performance.streamCapacityWarnPct': { min: 50, max: 98, step: 1, unit: '%' },
  'audit.retentionDays': { min: 90, max: 1825, step: 30, unit: 'days' },
};

export const NUMERIC_META_OF = (path: SettingPath): NumericMeta | undefined => NUMERIC_META[path];

/* ------------------------------------------------------------------ *
 * Human-readable labels for every configurable leaf — used by the
 * CONFIGURATION CHANGE HISTORY table and validation hints.
 * ------------------------------------------------------------------ */

export const FIELD_LABELS: Partial<Record<SettingPath, string>> = {
  'general.platformName': 'Platform name',
  'general.commandLocation': 'Command location',
  'general.timezone': 'Timezone',
  'general.dateFormat': 'Date format',
  'general.timeFormat': 'Time format',
  'general.autoRefreshSec': 'Auto-refresh interval',
  'general.theme': 'Console theme',
  'cameras.rtspTimeoutSec': 'RTSP connection timeout',
  'cameras.reconnectAttempts': 'Reconnect attempts',
  'cameras.exponentialBackoff': 'Exponential backoff',
  'cameras.maxConcurrentStreams': 'Maximum concurrent streams',
  'cameras.defaultProtocol': 'Default RTSP protocol',
  'cameras.h264Support': 'H.264 decode support',
  'cameras.h265Support': 'H.265 decode support',
  'cameras.webrtcPreview': 'WebRTC live preview',
  'cameras.hlsFallback': 'HLS fallback streaming',
  'cameras.defaultResolution': 'Default resolution',
  'cameras.targetFps': 'Target frame rate',
  'ai.vehicleDetectionEnabled': 'Vehicle detection',
  'ai.confidenceMin': 'Confidence threshold',
  'ai.classes': 'Detection classes',
  'ai.inferenceFps': 'Inference FPS',
  'ai.computeMode': 'Inference mode',
  'ai.processingInterval': 'Processing interval',
  'anpr.anprEnabled': 'ANPR engine',
  'anpr.ocrConfidenceMin': 'OCR confidence threshold',
  'anpr.plateFormats': 'Plate formats',
  'anpr.recognitionFrequency': 'Recognition frequency',
  'anpr.duplicateSuppression': 'Duplicate suppression',
  'anpr.duplicateWindowSec': 'Suppression window',
  'anpr.lowConfidenceHandling': 'Low-confidence handling',
  'tracking.trackingEnabled': 'Vehicle tracking',
  'tracking.crossCameraMatching': 'Cross-camera matching',
  'tracking.trackerSensitivity': 'Tracker sensitivity',
  'tracking.maxTrackingGapSec': 'Maximum tracking gap',
  'tracking.journeyHistory': 'Journey history duration',
  'tracking.reidConfidenceMin': 'Re-ID confidence floor',
  'tracking.storeSnapshots': 'Store journey snapshots',
  'watchlist.realtimeMatching': 'Real-time watchlist matching',
  'watchlist.criticalThresholdPerMin': 'Critical alert threshold',
  'watchlist.priorityLevels': 'Alert priority levels',
  'watchlist.soundAlert': 'Alert sound',
  'watchlist.autoEscalation': 'Automatic escalation',
  'watchlist.alertRetentionDays': 'Alert retention',
  'watchlist.watchlistAutoSync': 'Watchlist synchronization',
  'watchlist.syncIntervalMin': 'Sync interval',
  'gis.mapCenter': 'Default map center',
  'gis.zoomLevel': 'Default zoom level',
  'gis.layers': 'Map layers',
  'gis.markerClustering': 'Camera marker clustering',
  'gis.routeDisplay': 'Journey route display',
  'gis.liveVehicleTracking': 'Live vehicle tracking overlay',
  'gis.trackRefreshSec': 'Track refresh interval',
  'notifications.browserNotifications': 'Browser notifications',
  'notifications.dashboardAlerts': 'Dashboard alert feed',
  'notifications.emailNotify': 'Email dispatch',
  'notifications.smsNotify': 'SMS dispatch',
  'notifications.severities': 'Notification severity',
  'notifications.soundEnabled': 'Notification sound',
  'notifications.soundTone': 'Alert tone',
  'notifications.volume': 'Alert volume',
  'users.rbacEnforced': 'RBAC enforcement',
  'users.sessionTimeoutMin': 'Session timeout',
  'users.idleLockMin': 'Idle auto-lock',
  'users.passwordPolicy': 'Password policy',
  'users.passwordExpiryDays': 'Password expiry',
  'users.mfaRequired': 'Multi-factor authentication',
  'users.lockoutAttempts': 'Failed attempts before lockout',
  'users.lockoutDurationMin': 'Lockout duration',
  'users.defaultRole': 'Default role for new accounts',
  'storage.evidenceRetentionDays': 'Evidence retention',
  'storage.snapshotRetentionDays': 'Snapshot retention',
  'storage.videoRetentionDays': 'Video retention',
  'storage.metadataRetention': 'Metadata retention',
  'storage.automaticCleanup': 'Automatic cleanup',
  'storage.cleanupWindow': 'Cleanup window',
  'storage.storageWarningPct': 'Storage warning threshold',
  'storage.compressArchive': 'Compress archive volumes',
  'performance.cpuWarnPct': 'CPU warning threshold',
  'performance.cpuCritPct': 'CPU critical threshold',
  'performance.ramWarnPct': 'Memory warning threshold',
  'performance.inferenceLatencyWarnMs': 'Inference latency warning',
  'performance.streamCapacityWarnPct': 'Stream capacity warning',
  'security.secureSessionOnly': 'Secure sessions only',
  'security.apiAccessLevel': 'API access level',
  'security.auditLogging': 'Audit logging',
  'security.loginProtection': 'Login protection',
  'security.suspiciousAccessDetection': 'Suspicious-access detection',
  'security.suspiciousThreshold': 'Suspicion trigger',
  'security.encryptionAtRest': 'Encryption at rest',
  'security.encryptionInTransit': 'Encryption in transit',
  'security.restrictWorkstations': 'Restrict to registered workstations',
  'audit.recordLevel': 'Audit record level',
  'audit.retentionDays': 'Audit log retention',
  'audit.tamperEvidentHashing': 'Tamper-evident hashing',
  'audit.includePayloads': 'Record request payloads',
  'maintenance.maintenanceMode': 'Maintenance mode',
  'maintenance.maintenanceWindow': 'Maintenance window',
  'maintenance.autoRestartPolicy': 'Auto-restart policy',
  'maintenance.notifyOnCompletion': 'Completion notifications',
};

export const fieldLabel = (path: SettingPath): string => {
  const direct = FIELD_LABELS[path];
  if (direct) return direct;
  // Nested RBAC leaves: users.rolePermissions.<role>.<permission>
  const parts = path.split('.');
  if (parts.length === 4 && parts[0] === 'users' && parts[1] === 'rolePermissions') {
    const roleName = SETTINGS_ROLE_LABELS[parts[2] as SettingsRoleId];
    const permName = PERMISSION_LABELS[parts[3] as SettingsPermissionKey];
    return `${roleName ?? parts[2]} · ${permName ?? parts[3]} access`;
  }
  return parts[parts.length - 1] ?? path;
};

/* ------------------------------------------------------------------ *
 * Option dictionaries shared by selects / segmented controls / chips.
 * ------------------------------------------------------------------ */

export const TIMEZONE_OPTIONS = [
  'Asia/Kolkata (GMT+5:30)',
  'Asia/Kolkata — DST off',
  'Asia/Dubai (GMT+4:00)',
  'Asia/Karachi (GMT+5:00)',
  'UTC (GMT+0:00)',
];

export const DATE_FORMAT_OPTIONS = ['DD MMM YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'];

export const TIME_FORMAT_OPTIONS = [
  '12-hour (HH:MM:SS AM/PM)',
  '24-hour (HH:MM:SS)',
  '24-hour + IST (HH:MM:SS IST)',
];

export const RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p · 1280×720' },
  { value: '1080p', label: '1080p · 1920×1080' },
  { value: '1440p', label: '1440p · 2560×1440' },
  { value: '4K', label: '4K · 3840×2160' },
];

export const FPS_OPTIONS = [
  { value: 10, label: '10 FPS' },
  { value: 15, label: '15 FPS' },
  { value: 20, label: '20 FPS' },
  { value: 25, label: '25 FPS' },
  { value: 30, label: '30 FPS' },
];

export const CLASS_OPTIONS = [
  { value: 'car', label: 'Car' },
  { value: 'truck', label: 'Truck' },
  { value: 'bus', label: 'Bus' },
  { value: 'two-wheeler', label: 'Two-wheeler' },
  { value: 'auto-rickshaw', label: 'Auto rickshaw' },
  { value: 'pedestrian', label: 'Pedestrian' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'animal', label: 'Animal on road' },
];

export const PLATE_FORMAT_OPTIONS = [
  { value: 'gj-standard', label: 'GJ • 01 • AB • 1234' },
  { value: 'gj-long', label: 'GJ • 01 • AB • 12345' },
  { value: 'bh-series', label: 'BH • 01 • 234 • 5678 (Bharat)' },
  { value: 'cd-diplomat', label: 'CD / CC diplomatic corps' },
  { value: 'generic-8-12', label: 'Generic · 8–12 alphanumeric' },
];

export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Informational' },
];

export const MAP_CENTER_OPTIONS = [
  'Gandhinagar · 23.2156° N, 72.6369° E',
  'Ahmedabad · 23.0225° N, 72.5714° E',
  'Vadodara · 22.3072° N, 73.1812° E',
  'Surat · 21.1702° N, 72.8311° E',
  'Rajkot · 22.3039° N, 70.8022° E',
  'Bhavnagar · 21.7645° N, 72.1519° E',
  'Jamnagar · 22.4707° N, 70.0577° E',
  'Gujarat state · full extent',
];

export const LAYER_OPTIONS = [
  { value: 'streets', label: 'Streets' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'traffic-density', label: 'Traffic density' },
  { value: 'crime-heat', label: 'Crime heat' },
  { value: 'anpr-zones', label: 'ANPR zones' },
];

export const ROLE_OPTIONS = [
  { value: 'super-admin', label: 'Super Administrator' },
  { value: 'command-inspector', label: 'Command Inspector' },
  { value: 'investigation-officer', label: 'Investigation Officer' },
  { value: 'control-operator', label: 'Control Room Operator' },
  { value: 'traffic-analyst', label: 'Traffic Analyst' },
  { value: 'viewer', label: 'Viewer (read-only)' },
];

export const SETTINGS_ROLE_IDS: SettingsRoleId[] = [
  'super-admin',
  'command-inspector',
  'investigation-officer',
  'control-operator',
  'traffic-analyst',
  'viewer',
];

export const SETTINGS_ROLE_LABELS: Record<SettingsRoleId, string> = {
  'super-admin': 'Super Administrator',
  'command-inspector': 'Command Inspector',
  'investigation-officer': 'Investigation Officer',
  'control-operator': 'Control Room Operator',
  'traffic-analyst': 'Traffic Analyst',
  viewer: 'Viewer',
};

export const PERMISSION_KEYS: SettingsPermissionKey[] = [
  'platform-settings',
  'user-management',
  'watchlist-edits',
  'alerts-dispatch',
  'camera-admin',
  'reports-export',
];

export const PERMISSION_LABELS: Record<SettingsPermissionKey, string> = {
  'platform-settings': 'Settings',
  'user-management': 'Users',
  'watchlist-edits': 'Watchlist',
  'alerts-dispatch': 'Alerts',
  'camera-admin': 'Cameras',
  'reports-export': 'Reports',
};

/* ------------------------------------------------------------------ *
 * Change-history value formatting (for leaf diff rows).
 * ------------------------------------------------------------------ */

export function formatSettingValue(path: SettingPath, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'number') {
    const meta = NUMERIC_META_OF(path);
    return meta?.unit ? `${value} ${meta.unit}` : String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    const itemCount = optionCount(path, value);
    if (itemCount === null) return value.join(' · ');
    return `${value.length} of ${itemCount} selected`;
  }
  return String(value ?? '—');
}

function optionCount(path: SettingPath, _selected: string[]): number | null {
  const pools: Record<string, Array<{ value: string }>> = {
    'ai.classes': CLASS_OPTIONS,
    'anpr.plateFormats': PLATE_FORMAT_OPTIONS,
    'watchlist.priorityLevels': PRIORITY_OPTIONS,
    'gis.layers': LAYER_OPTIONS,
    'notifications.severities': PRIORITY_OPTIONS,
  };
  const pool = pools[path];
  return pool ? pool.length : null;
}

/** Compares every leaf of two snapshots and returns changed paths. */
export function diffPaths(prev: SystemConfig, next: SystemConfig): SettingPath[] {
  const paths: SettingPath[] = [];
  const walk = (a: Record<string, unknown>, b: Record<string, unknown>, prefix: string) => {
    Object.keys(b).forEach((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const va = a[key];
      const vb = b[key];
      if (Array.isArray(va) && Array.isArray(vb)) {
        if (JSON.stringify(va) !== JSON.stringify(vb)) paths.push(path);
      } else if (typeof va === 'object' && va !== null && typeof vb === 'object' && vb !== null) {
        walk(va as Record<string, unknown>, vb as Record<string, unknown>, path);
      } else if (va !== vb) {
        paths.push(path);
      }
    });
  };
  walk(prev as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>, '');
  return paths.sort();
}

/* ------------------------------------------------------------------ *
 * Runtime status items for the right-hand SYSTEM STATUS rail.
 * ------------------------------------------------------------------ */

export const RUNTIME_STATUS: RuntimeStatusItem[] = [
  {
    id: 'all',
    label: 'All Systems',
    sublabel: 'Platform aggregate',
    state: 'operational',
    badge: 'Operational',
    readout: '99.98% uptime · 31 d',
    icon: Server,
  },
  {
    id: 'ai',
    label: 'AI Engine',
    sublabel: 'YOLO · OCR · tracker',
    state: 'operational',
    badge: 'Operational',
    readout: '3/3 models · 31 ms',
    icon: BrainCircuit,
  },
  {
    id: 'gateway',
    label: 'Stream Gateway',
    sublabel: 'RTSP · WebRTC · HLS',
    state: 'operational',
    badge: 'Operational',
    readout: '1,210 sessions',
    icon: Cctv,
  },
  {
    id: 'database',
    label: 'Database',
    sublabel: 'Evidence & metadata',
    state: 'operational',
    badge: 'Operational',
    readout: '4 ms · 1.2 M ops/min',
    icon: Database,
  },
  {
    id: 'storage',
    label: 'Storage',
    sublabel: 'Archive cluster',
    state: 'operational',
    badge: 'Operational',
    readout: '74% used · 41 TB free',
    icon: HardDrive,
  },
  {
    id: 'network',
    label: 'Network',
    sublabel: 'Backbone uplink',
    state: 'good',
    badge: 'Good',
    readout: '6.8 Gbps · 12 ms',
    icon: Wifi,
  },
  {
    id: 'ws',
    label: 'WebSocket',
    sublabel: 'Realtime console bus',
    state: 'good',
    badge: 'Connected',
    readout: '128 clients · 14 ms',
    icon: Radio,
  },
];

/* ------------------------------------------------------------------ *
 * Seed audit-log entries (mock of GET /api/v1/audit).
 * ------------------------------------------------------------------ */

const AUDIT = (id: string, minutesAgo: number, user: string, role: string, action: string, module: string, ip: string, status: AuditStatus, detail: string): AuditLogEntry => {
  const d = new Date(Date.now() - minutesAgo * 60_000);
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const stamp = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const suffix = hh < 12 ? 'AM' : 'PM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return {
    id,
    timestamp: `${stamp} · ${String(hour12).padStart(2, '0')}:${mm}:${ss} ${suffix}`,
    user,
    role,
    action,
    module,
    ip,
    status,
    detail,
    actionKind: action.startsWith('Login') || action.startsWith('Logout')
      ? 'login'
      : action.startsWith('Export')
        ? 'export'
        : action.startsWith('Maintenance') || action.startsWith('Backup') || action.startsWith('Restart') || action.startsWith('Cache') || action.startsWith('Index')
          ? 'maintenance'
          : action.startsWith('MFA') || action.startsWith('Key') || action.startsWith('Lockout')
            ? 'security'
            : action.startsWith('Role') || action.startsWith('User')
              ? 'user-admin'
              : 'config',
  };
};

export const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  AUDIT('AUD-10284', 2, 'Insp. Rajveer Solanki', 'System Administrator', 'Config update', 'AI Detection', '10.4.12.7', 'success', 'Confidence threshold moved 85% → 90%'),
  AUDIT('AUD-10283', 6, 'Sub-Insp. Meera Patel', 'Control Room Operator', 'Login (MFA)', 'Auth', '172.19.8.44', 'success', 'TOTP + biometric verified'),
  AUDIT('AUD-10282', 9, 'Insp. Rajveer Solanki', 'System Administrator', 'Watchlist sync triggered', 'Watchlist', '10.4.12.7', 'success', '1,248 entries pushed to 214 edge nodes'),
  AUDIT('AUD-10281', 14, 'Head Const. Arjun Desai', 'Investigation Officer', 'Export evidence bundle', 'Investigation', '172.19.21.90', 'success', 'Case INV-2209 · 14 files · checksum verified'),
  AUDIT('AUD-10280', 18, 'Dr. Kavita Iyer', 'IT & Cyber Security', 'Role permission change', 'Users & Roles', '10.4.0.5', 'success', 'Control operators granted watchlist-edits'),
  AUDIT('AUD-10279', 25, 'Unknown terminal', '—', 'Login attempt blocked', 'Auth', '203.0.113.87', 'blocked', '5 failed attempts · lockout applied'),
  AUDIT('AUD-10278', 31, 'Insp. Rajveer Solanki', 'System Administrator', 'Maintenance — backup completed', 'System', '10.4.12.7', 'success', 'Backup BK-2026-0902 · 2.4 TB · 09:41'),
  AUDIT('AUD-10277', 40, 'PSI Nikhil Rathod', 'Traffic Analyst', 'Report export', 'Reports', '172.19.33.12', 'success', 'Traffic-flow weekly · 12 zones'),
  AUDIT('AUD-10276', 47, 'Automation', 'System', 'Config applied', 'Stream Gateway', '10.4.0.9', 'success', 'Nightly codec policy sync (192 nodes)'),
  AUDIT('AUD-10275', 55, 'Const. Devang Shah', 'Viewer', 'Session timeout', 'Auth', '172.19.5.61', 'warning', 'Idle 15 min · session closed'),
  AUDIT('AUD-10274', 63, 'Unknown terminal', '—', 'Brute-force attempt', 'Auth', '198.51.100.23', 'blocked', 'Rate-limited · source quarantined'),
  AUDIT('AUD-10273', 71, 'Insp. Rajveer Solanki', 'System Administrator', 'Key rotation scheduled', 'Security', '10.4.12.7', 'success', 'HSM key KR-2048 in 6 days'),
  AUDIT('AUD-10272', 82, 'Sub-Insp. Meera Patel', 'Control Room Operator', 'MFA re-enrollment', 'Auth', '172.19.8.44', 'success', 'New authenticator registered'),
  AUDIT('AUD-10271', 95, 'Sandeep Menon', 'IT & Cyber Security', 'Cache purge (segment)', 'System', '10.4.0.14', 'failed', 'Partial failure — 3 nodes unreachable'),
  AUDIT('AUD-10270', 110, 'Insp. Rajveer Solanki', 'System Administrator', 'Config update', 'General', '10.4.12.7', 'success', 'Auto-refresh interval 5 s → 10 s'),
  AUDIT('AUD-10269', 128, 'Head Const. Arjun Desai', 'Investigation Officer', 'Login', 'Auth', '172.19.21.90', 'success', 'Password + TOTP verified'),
];

/* ------------------------------------------------------------------ *
 * Seed CONFIGURATION CHANGE HISTORY rows (mock of /settings/changelog).
 * ------------------------------------------------------------------ */

const HISTORY_DATE = '02 Sep 2026';

export const SEED_HISTORY: ChangeHistoryEntry[] = [
  {
    id: 'CHG-00914',
    path: 'anpr.ocrConfidenceMin',
    settingLabel: 'OCR confidence threshold',
    previous: '85%',
    next: '88%',
    changedBy: 'Insp. Rajveer Solanki',
    timestamp: `${HISTORY_DATE} · 09:12:40 AM`,
    source: 'applied',
    status: 'Applied',
  },
  {
    id: 'CHG-00913',
    path: 'cameras.exponentialBackoff',
    settingLabel: 'Exponential backoff',
    previous: 'Disabled',
    next: 'Enabled',
    changedBy: 'Dr. Kavita Iyer',
    timestamp: `${HISTORY_DATE} · 08:47:03 AM`,
    source: 'applied',
    status: 'Applied',
  },
  {
    id: 'CHG-00912',
    path: 'watchlist.syncIntervalMin',
    settingLabel: 'Watchlist sync interval',
    previous: '15 min',
    next: '60 min',
    changedBy: 'Insp. Rajveer Solanki',
    timestamp: '01 Sep 2026 · 11:30:18 PM',
    source: 'saved',
    status: 'Saved',
  },
  {
    id: 'CHG-00911',
    path: 'general.theme',
    settingLabel: 'Console theme',
    previous: 'Midnight',
    next: 'Command navy',
    changedBy: 'Insp. Rajveer Solanki',
    timestamp: '01 Sep 2026 · 08:02:55 PM',
    source: 'applied',
    status: 'Applied',
  },
  {
    id: 'CHG-00910',
    path: 'security.suspiciousAccessDetection',
    settingLabel: 'Suspicious-access detection',
    previous: 'Disabled',
    next: 'Enabled',
    changedBy: 'Dr. Kavita Iyer',
    timestamp: '31 Aug 2026 · 04:15:22 PM',
    source: 'applied',
    status: 'Applied',
  },
  {
    id: 'CHG-00909',
    path: 'storage.storageWarningPct',
    settingLabel: 'Storage warning threshold',
    previous: '85%',
    next: '80%',
    changedBy: 'Sandeep Menon',
    timestamp: '30 Aug 2026 · 10:44:11 AM',
    source: 'saved',
    status: 'Saved',
  },
];

/* ------------------------------------------------------------------ *
 * Maintenance action tiles.
 * ------------------------------------------------------------------ */

export const MAINTENANCE_ACTIONS: MaintenanceActionDef[] = [
  {
    id: 'backup',
    label: 'Backup Database',
    description: 'Full encrypted snapshot of evidence, metadata and watchlist state',
    icon: CloudUpload,
    tone: 'primary',
    destructive: false,
    lastRun: 'Today · 09:41 IST',
    durationHint: '~4 min',
  },
  {
    id: 'clear-cache',
    label: 'Clear Cache',
    description: 'Purge thumbnail, tile and segment caches — safe to run on live traffic',
    icon: Trash2,
    tone: 'warn',
    destructive: true,
    lastRun: '01 Sep · 03:00 IST',
    durationHint: '< 1 min',
  },
  {
    id: 'rebuild-index',
    label: 'Rebuild Index',
    description: 'Recreate search & ANPR lookup indexes from the metadata store',
    icon: RotateCw,
    tone: 'warn',
    destructive: true,
    lastRun: '28 Aug · 02:30 IST',
    durationHint: '~8 min',
  },
  {
    id: 'restart-ai',
    label: 'Restart AI Engine',
    description: 'Reload detection models and OCR pipelines on all inference nodes',
    icon: BrainCircuit,
    tone: 'warn',
    destructive: true,
    lastRun: '01 Sep · 06:12 IST',
    durationHint: '~90 s',
  },
  {
    id: 'restart-gateway',
    label: 'Restart Stream Gateway',
    description: 'Re-establish RTSP / WebRTC / HLS sessions — brief stream interruption',
    icon: Cctv,
    tone: 'danger',
    destructive: true,
    lastRun: '25 Aug · 03:00 IST',
    durationHint: '~2 min',
  },
  {
    id: 'test-cameras',
    label: 'Test All Cameras',
    description: 'Ping 12,842 registered feeds and report reachability per district',
    icon: Camera,
    tone: 'primary',
    destructive: false,
    lastRun: '02 Sep · 08:00 IST',
    durationHint: '~3 min',
  },
];

/** Simulated per-action completion messages for the toast/audit trail. */
export const MAINTENANCE_RESULTS: Record<MaintenanceActionDef['id'], string> = {
  backup: 'Backup BK-2026-0902 created · 2.4 TB encrypted · checksum verified',
  'clear-cache': 'Cache cleared · 41.6 GB reclaimed across 6 regions',
  'rebuild-index': 'Index rebuilt · 4.2 M documents indexed in 6 min 41 s',
  'restart-ai': 'AI Engine restarted · 3/3 models loaded on 4 inference nodes',
  'restart-gateway': 'Stream Gateway restarted · 1,210 sessions re-established',
  'test-cameras': 'Camera sweep complete · 11,243 online · 1,128 offline · 471 poor signal',
};

/* ------------------------------------------------------------------ *
 * Environment / deployment card meta.
 * ------------------------------------------------------------------ */

export const DEPLOYMENT_META = {
  version: 'v4.2.1 · build 2081',
  deployed: '01 Sep 2026 · 22:14 IST',
  node: 'Gandhinagar Core · Region A',
  operator: 'Insp. Rajveer Solanki',
  operatorRole: 'System Administrator',
  lastConfig: '02 Sep 2026 · 09:12 AM',
};

/** Actor label used when recording changes (mock auth context). */
export const SESSION_ACTOR = 'Insp. Rajveer Solanki';

export const SECTION_META_LIST: SettingsSectionMeta[] = SECTION_ORDER.map((id) => SECTION_META[id]);

/** Human label for a settings section id (used by apply runbook). */
export const sectionLabelOf = (id: string): string => {
  const meta = SECTION_META[id as SettingsSectionId];
  return meta ? meta.label : id;
};

/** Status chip class map reused by audit log + history tables. */
export const AUDIT_STATUS_CHIP: Record<AuditStatus, string> = {
  success: 'border-accent-green/40 bg-[#0b2e26] text-[#6fe0b0]',
  warning: 'border-[#f59e0b]/40 bg-[#2b1a06] text-[#f7b95f]',
  failed: 'border-accent-red/40 bg-[#2b0b10] text-[#ff8b96]',
  blocked: 'border-accent-red/50 bg-[#2b0b10] text-[#ff8b96]',
};


