import type { LucideIcon } from 'lucide-react';

import type { Severity } from '@/types';

/* ------------------------------------------------------------------ *
 * Reports workspace — INTELLIGENCE REPORTS & ANALYTICS
 *
 * Every shape here is what the future reporting backend will serve
 * (`GET /reports`, `POST /reports/generate`, `GET /reports/:id/preview`,
 * `GET /reports/schedules`). The page renders from `data/reportsData.ts`
 * today, so wiring the API later is a data-source swap only.
 * ------------------------------------------------------------------ */

export type ReportTypeId =
  | 'vehicle-intelligence'
  | 'watchlist-activity'
  | 'alert-summary'
  | 'camera-health'
  | 'traffic-analytics'
  | 'cross-camera-journey'
  | 'daily-operations';

export type ReportStatus = 'completed' | 'generating' | 'pending' | 'failed';

export type ReportFormat = 'PDF' | 'CSV' | 'XLSX';

export type ReportClassification = 'restricted' | 'internal' | 'confidential';

export interface ReportTypeDef {
  id: ReportTypeId;
  label: string;
  /** Compact label for chips / chart axes. */
  short: string;
  icon: LucideIcon;
  color: string;
  description: string;
  /** Sections the generator composes into the document. */
  sections: string[];
  /** Typical render time shown in the configuration modal. */
  etaSec: number;
}

export interface ReportRecord {
  id: string;
  name: string;
  type: ReportTypeId;
  /** Display timestamp, e.g. "02 Sep 2026 · 17:42:10". */
  generatedAt: string;
  createdBy: string;
  creatorRank: string;
  status: ReportStatus;
  /** Null while the document is still rendering / queued. */
  sizeMb: number | null;
  format: ReportFormat;
  pages: number;
  classification: ReportClassification;
  /** Primary scope of the report (city / corridor). */
  scope: string;
  /** Cameras covered by the query window. */
  cameras: number;
  /** Detections / events folded into the document. */
  records: number;
}

export interface ReportFilters {
  type: ReportTypeId;
  range: string;
  location: string;
  camera: string;
  department: string;
  severity: 'all' | Severity;
}

export interface GenerateReportConfig extends ReportFilters {
  name: string;
  format: ReportFormat;
  classification: ReportClassification;
  sections: string[];
  notifyRecipient: string;
  /** 'now' renders immediately; 'schedule' registers a recurring job. */
  mode: 'now' | 'schedule';
  frequency: ScheduleFrequency;
  runAt: string;
}

export type ScheduleFrequency = 'hourly' | 'every-6-hours' | 'daily' | 'weekly' | 'monthly';

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportTypeId;
  frequency: ScheduleFrequency;
  /** Human readable cadence detail, e.g. "Daily · 06:00 IST". */
  cadence: string;
  nextRun: string;
  lastRun: string;
  recipient: string;
  recipientRole: string;
  format: ReportFormat;
  active: boolean;
}

/* ---------------- analytics ---------------- */

export interface ReportsByTypeSlice {
  type: ReportTypeId;
  label: string;
  count: number;
  color: string;
}

export interface ReportsTrendPoint {
  /** Short axis label, e.g. "20 Aug". */
  label: string;
  generated: number;
  scheduled: number;
}

export interface DistributionSlice {
  id: string;
  label: string;
  percent: number;
  count: number;
  color: string;
}

export interface TopReportedLocation {
  rank: number;
  location: string;
  city: string;
  reports: number;
  share: number;
  dominantType: string;
  tone: 'red' | 'orange' | 'blue' | 'cyan';
}

/* ---------------- sample preview document ---------------- */

export interface PreviewJourneyLeg {
  step: number;
  time: string;
  cameraCode: string;
  road: string;
  city: string;
  speed: string;
  confidence: number;
  alert?: boolean;
}

export interface PreviewStat {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'cyan';
}

export interface PreviewEvidence {
  id: string;
  cameraCode: string;
  caption: string;
  time: string;
  thumbnail: string;
  flagged?: boolean;
}

export interface PreviewFinding {
  id: string;
  text: string;
  severity: Severity;
}

export interface PreviewRoutePoint {
  x: number;
  y: number;
  cameraCode: string;
  alert?: boolean;
}

export interface ReportPreviewDoc {
  reportId: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  generatedBy: string;
  classification: ReportClassification;
  vehicle: {
    plate: string;
    description: string;
    owner: string;
    watchlist: string;
    snapshot: string;
    confidence: number;
  };
  journey: PreviewJourneyLeg[];
  alertSummary: Array<{ label: string; count: number; severity: Severity }>;
  stats: PreviewStat[];
  evidence: PreviewEvidence[];
  route: PreviewRoutePoint[];
  findings: PreviewFinding[];
}
