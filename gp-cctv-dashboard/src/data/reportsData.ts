import {
  Activity,
  BellRing,
  Car,
  ClipboardList,
  GitBranch,
  HeartPulse,
  ShieldAlert,
} from 'lucide-react';

import camC001 from '@/assets/cam-c001.jpg';
import camC007 from '@/assets/cam-c007.jpg';
import camC015 from '@/assets/cam-c015.jpg';
import camC038 from '@/assets/cam-c038.jpg';
import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';

import type {
  DistributionSlice,
  GenerateReportConfig,
  ReportFilters,
  ReportPreviewDoc,
  ReportRecord,
  ReportTypeDef,
  ReportTypeId,
  ReportsByTypeSlice,
  ReportsTrendPoint,
  ScheduleFrequency,
  ScheduledReport,
  TopReportedLocation,
} from '@/types/reports';

/* ------------------------------------------------------------------ *
 * Reports workspace mock data (frontend only).
 *
 * Backend seams:
 *   · registry rows      → GET  /reports?range=…
 *   · generate           → POST /reports/generate      (services/api.ts)
 *   · preview document   → GET  /reports/:id/preview
 *   · schedules          → GET  /reports/schedules
 *   · download           → GET  /reports/:id/download  (signed URL → PDF)
 * ------------------------------------------------------------------ */

/* ---------------- report catalogue ---------------- */

export const reportTypes: ReportTypeDef[] = [
  {
    id: 'vehicle-intelligence',
    label: 'Vehicle Intelligence',
    short: 'Vehicle Intel',
    icon: Car,
    color: '#22d3ee',
    description: 'ANPR detections, movement profile, ownership and cross-camera correlation for a plate or vehicle class.',
    sections: ['Vehicle profile', 'Detection timeline', 'Camera journey', 'Watchlist correlation', 'Evidence appendix'],
    etaSec: 18,
  },
  {
    id: 'watchlist-activity',
    label: 'Watchlist Activity',
    short: 'Watchlist',
    icon: ShieldAlert,
    color: '#a855f7',
    description: 'Matches, misses and dwell analysis for every active watchlist entry in the selected window.',
    sections: ['Match register', 'Category breakdown', 'Hot entries', 'Response log'],
    etaSec: 12,
  },
  {
    id: 'alert-summary',
    label: 'Alert Summary',
    short: 'Alerts',
    icon: BellRing,
    color: '#ef4444',
    description: 'Alert volume, severity mix, acknowledgement latency and escalation outcomes across the command.',
    sections: ['Severity matrix', 'Response timeline', 'Top alert sources', 'Unresolved queue'],
    etaSec: 9,
  },
  {
    id: 'camera-health',
    label: 'Camera Health',
    short: 'Cam Health',
    icon: HeartPulse,
    color: '#22c55e',
    description: 'Fleet uptime, stream quality, packet loss and AI pipeline health for the monitored cameras.',
    sections: ['Fleet scorecard', 'Offline register', 'Stream quality trend', 'Maintenance queue'],
    etaSec: 8,
  },
  {
    id: 'traffic-analytics',
    label: 'Traffic Analytics',
    short: 'Traffic',
    icon: Activity,
    color: '#2f7dff',
    description: 'Vehicle counts, classification split, peak-hour flow and corridor speed profile from the analytics engine.',
    sections: ['Flow summary', 'Class distribution', 'Peak-hour heatmap', 'Corridor comparison'],
    etaSec: 15,
  },
  {
    id: 'cross-camera-journey',
    label: 'Investigation / Cross-Camera Journey',
    short: 'Journey',
    icon: GitBranch,
    color: '#f59e0b',
    description: 'Case-grade reconstruction of a target vehicle across gantries with route map and chain-of-custody evidence.',
    sections: ['Target dossier', 'Journey reconstruction', 'Route map', 'Related vehicles', 'Evidence chain'],
    etaSec: 26,
  },
  {
    id: 'daily-operations',
    label: 'Daily Operations',
    short: 'Daily Ops',
    icon: ClipboardList,
    color: '#eab308',
    description: 'Shift-wise command summary: detections, alerts, watchlist hits, camera availability and operator actions.',
    sections: ['Command KPIs', 'Shift log', 'Incident digest', 'System health'],
    etaSec: 10,
  },
];

export function reportTypeById(id: ReportTypeId): ReportTypeDef {
  return reportTypes.find((type) => type.id === id) ?? reportTypes[0];
}

/* ---------------- filter option sets ---------------- */

export const rangeOptions = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Custom Range'];

export const locationOptions = [
  'All Gujarat',
  'Ahmedabad City',
  'Gandhinagar',
  'Surat City',
  'Vadodara City',
  'Rajkot City',
  'SG Highway Corridor',
  'NH-147 Corridor',
];

export const cameraOptions = [
  'All Cameras',
  'C-001 · Shahibaug Road',
  'C-007 · Naranpura Road',
  'C-015 · Kudasan Road',
  'C-038 · Gift City Road',
  'C-045 · SG Highway',
  'C-089 · Maninagar',
  'C-115 · Iscon Cross Road',
  'C-207 · Varachha Ring Road',
];

export const departmentOptions = [
  'All Departments',
  'Control Room',
  'Crime Branch',
  'Traffic Police',
  'Special Operations Group',
  'Cyber Cell',
];

export const severityOptions: Array<{ id: ReportFilters['severity']; label: string }> = [
  { id: 'all', label: 'All Severities' },
  { id: 'critical', label: 'Critical Only' },
  { id: 'high', label: 'High & Above' },
  { id: 'medium', label: 'Medium & Above' },
  { id: 'info', label: 'Include Info' },
];

export const defaultReportFilters: ReportFilters = {
  type: 'vehicle-intelligence',
  range: 'Last 24 Hours',
  location: 'All Gujarat',
  camera: 'All Cameras',
  department: 'All Departments',
  severity: 'all',
};

export const defaultGenerateConfig: GenerateReportConfig = {
  ...defaultReportFilters,
  name: '',
  format: 'PDF',
  classification: 'restricted',
  sections: reportTypeById('vehicle-intelligence').sections,
  notifyRecipient: 'Control Room · Gandhinagar',
  mode: 'now',
  frequency: 'daily',
  runAt: '06:00',
};

/* ---------------- KPI strip ---------------- */

export const reportKpis = {
  generated: 128,
  pending: 6,
  investigation: 42,
  alert: 57,
  scheduled: 23,
};

/* ---------------- recent reports registry ---------------- */

export const recentReports: ReportRecord[] = [
  {
    id: 'RPT-2026-0912',
    name: 'Vehicle Intelligence — GJ01AB1234 (White Swift Dzire)',
    type: 'vehicle-intelligence',
    generatedAt: '02 Sep 2026 · 10:52:18',
    createdBy: 'Rajveer Chauhan',
    creatorRank: 'Inspector',
    status: 'completed',
    sizeMb: 4.8,
    format: 'PDF',
    pages: 18,
    classification: 'restricted',
    scope: 'Ahmedabad → Gandhinagar',
    cameras: 9,
    records: 27,
  },
  {
    id: 'RPT-2026-0911',
    name: 'Cross-Camera Journey — Case CASE-2026-0847',
    type: 'cross-camera-journey',
    generatedAt: '02 Sep 2026 · 10:31:04',
    createdBy: 'Kavita Sharma',
    creatorRank: 'DySP',
    status: 'completed',
    sizeMb: 11.2,
    format: 'PDF',
    pages: 34,
    classification: 'confidential',
    scope: 'NH-147 Corridor',
    cameras: 14,
    records: 63,
  },
  {
    id: 'RPT-2026-0910',
    name: 'Alert Summary — Ahmedabad City (24 h)',
    type: 'alert-summary',
    generatedAt: '02 Sep 2026 · 09:00:11',
    createdBy: 'Meera Desai',
    creatorRank: 'SI',
    status: 'completed',
    sizeMb: 2.3,
    format: 'PDF',
    pages: 9,
    classification: 'internal',
    scope: 'Ahmedabad City',
    cameras: 412,
    records: 186,
  },
  {
    id: 'RPT-2026-0909',
    name: 'Watchlist Activity Digest — High Priority Vehicles',
    type: 'watchlist-activity',
    generatedAt: '02 Sep 2026 · 08:15:47',
    createdBy: 'Vikram Rathod',
    creatorRank: 'PI',
    status: 'completed',
    sizeMb: 3.1,
    format: 'PDF',
    pages: 12,
    classification: 'restricted',
    scope: 'All Gujarat',
    cameras: 1240,
    records: 91,
  },
  {
    id: 'RPT-2026-0908',
    name: 'Daily Operations Brief — Night Shift (01 Sep)',
    type: 'daily-operations',
    generatedAt: '02 Sep 2026 · 06:00:02',
    createdBy: 'Auto Scheduler',
    creatorRank: 'System',
    status: 'completed',
    sizeMb: 1.9,
    format: 'PDF',
    pages: 7,
    classification: 'internal',
    scope: 'All Gujarat',
    cameras: 12842,
    records: 20437,
  },
  {
    id: 'RPT-2026-0907',
    name: 'Traffic Analytics — SG Highway Peak Flow',
    type: 'traffic-analytics',
    generatedAt: '01 Sep 2026 · 19:42:33',
    createdBy: 'Nilesh Patel',
    creatorRank: 'ACP',
    status: 'completed',
    sizeMb: 6.4,
    format: 'XLSX',
    pages: 22,
    classification: 'internal',
    scope: 'SG Highway Corridor',
    cameras: 86,
    records: 48211,
  },
  {
    id: 'RPT-2026-0906',
    name: 'Camera Health Audit — Surat Zone 4',
    type: 'camera-health',
    generatedAt: '01 Sep 2026 · 17:28:56',
    createdBy: 'Kiran Joshi',
    creatorRank: 'Head Constable',
    status: 'pending',
    sizeMb: null,
    format: 'PDF',
    pages: 0,
    classification: 'internal',
    scope: 'Surat City',
    cameras: 318,
    records: 318,
  },
  {
    id: 'RPT-2026-0905',
    name: 'Vehicle Intelligence — GJ05CD5678 (Grey Ertiga)',
    type: 'vehicle-intelligence',
    generatedAt: '01 Sep 2026 · 16:05:20',
    createdBy: 'Arjun Solanki',
    creatorRank: 'SI',
    status: 'generating',
    sizeMb: null,
    format: 'PDF',
    pages: 0,
    classification: 'restricted',
    scope: 'Vadodara City',
    cameras: 6,
    records: 14,
  },
  {
    id: 'RPT-2026-0904',
    name: 'Alert Escalation Review — Critical (7 d)',
    type: 'alert-summary',
    generatedAt: '01 Sep 2026 · 14:47:09',
    createdBy: 'Kavita Sharma',
    creatorRank: 'DySP',
    status: 'completed',
    sizeMb: 5.7,
    format: 'PDF',
    pages: 26,
    classification: 'confidential',
    scope: 'All Gujarat',
    cameras: 12842,
    records: 342,
  },
  {
    id: 'RPT-2026-0903',
    name: 'Watchlist Match Export — Stolen Vehicles',
    type: 'watchlist-activity',
    generatedAt: '01 Sep 2026 · 11:22:41',
    createdBy: 'Meera Desai',
    creatorRank: 'SI',
    status: 'completed',
    sizeMb: 0.8,
    format: 'CSV',
    pages: 1,
    classification: 'restricted',
    scope: 'Rajkot City',
    cameras: 204,
    records: 57,
  },
  {
    id: 'RPT-2026-0902',
    name: 'Traffic Analytics — Varachha Ring Road (30 d)',
    type: 'traffic-analytics',
    generatedAt: '31 Aug 2026 · 21:18:37',
    createdBy: 'Nilesh Patel',
    creatorRank: 'ACP',
    status: 'failed',
    sizeMb: null,
    format: 'XLSX',
    pages: 0,
    classification: 'internal',
    scope: 'Surat City',
    cameras: 42,
    records: 0,
  },
  {
    id: 'RPT-2026-0901',
    name: 'Cross-Camera Journey — GJ18AB1080 (Blue Tempo)',
    type: 'cross-camera-journey',
    generatedAt: '31 Aug 2026 · 18:54:12',
    createdBy: 'Rajveer Chauhan',
    creatorRank: 'Inspector',
    status: 'completed',
    sizeMb: 9.6,
    format: 'PDF',
    pages: 29,
    classification: 'confidential',
    scope: 'Ahmedabad City',
    cameras: 11,
    records: 44,
  },
];

/* ---------------- registry helpers ---------------- */

let reportSeq = 913;

/** Next RPT id for operator-generated documents. */
export function nextReportId(): string {
  const id = `RPT-2026-${String(reportSeq).padStart(4, '0')}`;
  reportSeq += 1;
  return id;
}

export function formatSize(sizeMb: number | null): string {
  if (sizeMb == null) return '—';
  return sizeMb < 1 ? `${Math.round(sizeMb * 1024)} KB` : `${sizeMb.toFixed(1)} MB`;
}

/** CSV export of the visible registry (header Export action). */
export function reportsRegistryCsv(rows: ReportRecord[]): string {
  const head = 'Report ID,Report Name,Type,Generated,Created By,Status,Format,Size (MB),Pages,Scope,Cameras,Records';
  const body = rows.map((row) =>
    [
      row.id,
      `"${row.name}"`,
      reportTypeById(row.type).label,
      `"${row.generatedAt}"`,
      `"${row.creatorRank} ${row.createdBy}"`,
      row.status,
      row.format,
      row.sizeMb ?? '',
      row.pages,
      `"${row.scope}"`,
      row.cameras,
      row.records,
    ].join(','),
  );
  return [head, ...body].join('\n');
}

/** Plain-text body used by the mock per-row Download action. */
export function reportDownloadBody(row: ReportRecord): string {
  const type = reportTypeById(row.type);
  return [
    'GUJARAT POLICE — UNIFIED AI CCTV INTELLIGENCE PLATFORM',
    '======================================================',
    `Report ID       : ${row.id}`,
    `Title           : ${row.name}`,
    `Type            : ${type.label}`,
    `Generated       : ${row.generatedAt} IST`,
    `Created by      : ${row.creatorRank} ${row.createdBy}`,
    `Classification  : ${row.classification.toUpperCase()}`,
    `Scope           : ${row.scope}`,
    `Cameras covered : ${row.cameras}`,
    `Records folded  : ${row.records.toLocaleString('en-IN')}`,
    '',
    `Sections: ${type.sections.join(' · ')}`,
    '',
    'This is a frontend mock artefact. The production platform streams the',
    'rendered PDF from GET /reports/:id/download via a signed URL.',
  ].join('\n');
}

/* ---------------- report analytics ---------------- */

export const reportsByType: ReportsByTypeSlice[] = [
  { type: 'vehicle-intelligence', label: 'Vehicle Intelligence', count: 34, color: '#22d3ee' },
  { type: 'alert-summary', label: 'Alert Summary', count: 26, color: '#ef4444' },
  { type: 'watchlist-activity', label: 'Watchlist Activity', count: 21, color: '#a855f7' },
  { type: 'cross-camera-journey', label: 'Investigation / Journey', count: 18, color: '#f59e0b' },
  { type: 'traffic-analytics', label: 'Traffic Analytics', count: 14, color: '#2f7dff' },
  { type: 'camera-health', label: 'Camera Health', count: 9, color: '#22c55e' },
  { type: 'daily-operations', label: 'Daily Operations', count: 6, color: '#eab308' },
];

/** 14-day generation trend ending 02 Sep 2026. */
export const reportsTrend: ReportsTrendPoint[] = [
  { label: '20 Aug', generated: 6, scheduled: 3 },
  { label: '21 Aug', generated: 8, scheduled: 3 },
  { label: '22 Aug', generated: 5, scheduled: 3 },
  { label: '23 Aug', generated: 9, scheduled: 4 },
  { label: '24 Aug', generated: 7, scheduled: 4 },
  { label: '25 Aug', generated: 11, scheduled: 4 },
  { label: '26 Aug', generated: 9, scheduled: 4 },
  { label: '27 Aug', generated: 12, scheduled: 5 },
  { label: '28 Aug', generated: 10, scheduled: 5 },
  { label: '29 Aug', generated: 8, scheduled: 5 },
  { label: '30 Aug', generated: 13, scheduled: 5 },
  { label: '31 Aug', generated: 11, scheduled: 6 },
  { label: '01 Sep', generated: 14, scheduled: 6 },
  { label: '02 Sep', generated: 12, scheduled: 6 },
];

export const reportDistribution: DistributionSlice[] = [
  { id: 'alert', label: 'Alert Reports', percent: 45, count: 57, color: '#ef4444' },
  { id: 'vehicle', label: 'Vehicle Reports', percent: 33, count: 42, color: '#22d3ee' },
  { id: 'watchlist', label: 'Watchlist Reports', percent: 22, count: 29, color: '#a855f7' },
];

export const topReportedLocations: TopReportedLocation[] = [
  { rank: 1, location: 'SG Highway', city: 'Ahmedabad', reports: 22, share: 100, dominantType: 'Traffic Analytics', tone: 'red' },
  { rank: 2, location: 'Iscon Cross Road', city: 'Ahmedabad', reports: 18, share: 82, dominantType: 'Alert Summary', tone: 'orange' },
  { rank: 3, location: 'Gift City Road', city: 'Gandhinagar', reports: 15, share: 68, dominantType: 'Vehicle Intelligence', tone: 'cyan' },
  { rank: 4, location: 'Sarkhej–Gandhinagar Hwy', city: 'Ahmedabad', reports: 13, share: 59, dominantType: 'Journey Reconstruction', tone: 'blue' },
  { rank: 5, location: 'Varachha Ring Road', city: 'Surat', reports: 11, share: 50, dominantType: 'Traffic Analytics', tone: 'blue' },
  { rank: 6, location: 'Alkapuri Circle', city: 'Vadodara', reports: 9, share: 41, dominantType: 'Watchlist Activity', tone: 'cyan' },
];

/* ---------------- scheduled reports ---------------- */

export const frequencyLabel: Record<ScheduleFrequency, string> = {
  hourly: 'Hourly',
  'every-6-hours': 'Every 6 hrs',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const scheduledReports: ScheduledReport[] = [
  {
    id: 'SCH-014',
    name: 'Daily Operations Brief',
    type: 'daily-operations',
    frequency: 'daily',
    cadence: 'Daily · 06:00 IST',
    nextRun: '03 Sep 2026 · 06:00',
    lastRun: '02 Sep · 06:00',
    recipient: 'DGP Office',
    recipientRole: 'Command',
    format: 'PDF',
    active: true,
  },
  {
    id: 'SCH-009',
    name: 'Critical Alert Escalation Digest',
    type: 'alert-summary',
    frequency: 'every-6-hours',
    cadence: 'Every 6 hrs · :00',
    nextRun: '02 Sep 2026 · 18:00',
    lastRun: '02 Sep · 12:00',
    recipient: 'Control Room Duty Desk',
    recipientRole: 'Operations',
    format: 'PDF',
    active: true,
  },
  {
    id: 'SCH-021',
    name: 'Watchlist Match Register',
    type: 'watchlist-activity',
    frequency: 'daily',
    cadence: 'Daily · 20:30 IST',
    nextRun: '02 Sep 2026 · 20:30',
    lastRun: '01 Sep · 20:30',
    recipient: 'Crime Branch — Insp. Rajveer Chauhan',
    recipientRole: 'Investigation',
    format: 'PDF',
    active: true,
  },
  {
    id: 'SCH-011',
    name: 'ANPR Camera Uptime Scorecard',
    type: 'camera-health',
    frequency: 'daily',
    cadence: 'Daily · 07:15 IST',
    nextRun: '03 Sep 2026 · 07:15',
    lastRun: '02 Sep · 07:15',
    recipient: 'Network Operations Centre',
    recipientRole: 'Maintenance',
    format: 'CSV',
    active: true,
  },
  {
    id: 'SCH-017',
    name: 'Weekly Traffic Flow — SG Highway',
    type: 'traffic-analytics',
    frequency: 'weekly',
    cadence: 'Weekly · Mon 08:00',
    nextRun: '07 Sep 2026 · 08:00',
    lastRun: '31 Aug · 08:00',
    recipient: 'Traffic Police — ACP Nilesh Patel',
    recipientRole: 'Traffic',
    format: 'XLSX',
    active: true,
  },
  {
    id: 'SCH-005',
    name: 'Monthly Command Intelligence Review',
    type: 'cross-camera-journey',
    frequency: 'monthly',
    cadence: 'Monthly · 1st 09:00',
    nextRun: '01 Oct 2026 · 09:00',
    lastRun: '01 Sep · 09:00',
    recipient: 'Home Department, Gandhinagar',
    recipientRole: 'Command',
    format: 'PDF',
    active: false,
  },
];

/* ---------------- sample preview document ---------------- */

export const sampleReportPreview: ReportPreviewDoc = {
  reportId: 'RPT-2026-0912',
  title: 'Vehicle Intelligence Report',
  subtitle: 'GJ01AB1234 · White Maruti Swift Dzire · Watchlist WL-001',
  generatedAt: '02 Sep 2026 · 10:52:18 IST',
  generatedBy: 'Inspector Rajveer Chauhan · Gandhinagar Command',
  classification: 'restricted',
  vehicle: {
    plate: 'GJ01AB1234',
    description: 'Maruti Swift Dzire VXi · White (pearl) · 2019 · LMV Sedan',
    owner: 'Arjun Rathod · GJ-01 Ahmedabad',
    watchlist: 'High Priority Vehicles · WL-001 · added 02 Mar 2026',
    snapshot: vehicleSnapshot,
    confidence: 98.7,
  },
  journey: [
    { step: 1, time: '10:21:15', cameraCode: 'C-001', road: 'Shahibaug Road', city: 'Ahmedabad', speed: '42 km/h', confidence: 97.2 },
    { step: 2, time: '10:28:42', cameraCode: 'C-007', road: 'Naranpura Road', city: 'Ahmedabad', speed: '51 km/h', confidence: 96.4 },
    { step: 3, time: '10:34:18', cameraCode: 'C-015', road: 'Kudasan Road', city: 'Gandhinagar', speed: '64 km/h', confidence: 98.1 },
    { step: 4, time: '10:44:03', cameraCode: 'C-038', road: 'Gift City Road', city: 'Gandhinagar', speed: '58 km/h', confidence: 99.0, alert: true },
  ],
  alertSummary: [
    { label: 'Watchlist match — intercept advised', count: 1, severity: 'critical' },
    { label: 'Signal jump — Kudasan junction', count: 1, severity: 'high' },
    { label: 'Speed threshold 60+ in city zone', count: 2, severity: 'medium' },
  ],
  stats: [
    { label: 'Detections (24 h)', value: '27', tone: 'cyan' },
    { label: 'Cameras crossed', value: '9' },
    { label: 'Corridor distance', value: '23.4 km' },
    { label: 'Journey window', value: '22 min 48 s' },
    { label: 'Mean OCR confidence', value: '97.7%', tone: 'green' },
    { label: 'Open alerts', value: '2', tone: 'red' },
  ],
  evidence: [
    { id: 'EV-01', cameraCode: 'C-001', caption: 'Entry frame · Shahibaug', time: '10:21:15', thumbnail: camC001 },
    { id: 'EV-02', cameraCode: 'C-007', caption: 'Lane 2 · Naranpura', time: '10:28:42', thumbnail: camC007 },
    { id: 'EV-03', cameraCode: 'C-015', caption: 'Kudasan junction', time: '10:34:18', thumbnail: camC015 },
    { id: 'EV-04', cameraCode: 'C-038', caption: 'Match frame · Gift City', time: '10:44:03', thumbnail: camC038, flagged: true },
  ],
  route: [
    { x: 12, y: 78, cameraCode: 'C-001' },
    { x: 34, y: 58, cameraCode: 'C-007' },
    { x: 58, y: 44, cameraCode: 'C-015' },
    { x: 84, y: 22, cameraCode: 'C-038', alert: true },
  ],
  findings: [
    { id: 'F-1', text: 'Vehicle followed the NH-147 corridor northbound; no counter-flow or plate-swap behaviour detected.', severity: 'info' },
    { id: 'F-2', text: 'Positive watchlist match at C-038 Gift City Road (99.0% OCR). Intercept advisory issued to Gandhinagar control.', severity: 'critical' },
    { id: 'F-3', text: 'Convoy candidate GJ06EF9012 shared 6 consecutive gantries — recommend companion dossier.', severity: 'high' },
    { id: 'F-4', text: 'Registered insurance expired 14 Feb 2026; flag for e-challan follow-up with RTO GJ-01.', severity: 'medium' },
  ],
};
