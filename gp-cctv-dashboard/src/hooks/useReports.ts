/**
 * Real-data hook for the Reports workspace.
 *
 * Loads generated intelligence reports from the FastAPI backend (real
 * PostgreSQL data — ANPR activity, vehicle journeys, watchlist alerts,
 * camera health, investigations), generates new reports via POST
 * /api/reports/generate, and exposes the real download URL. When the backend
 * is unreachable the page keeps the bundled demo fixtures so the command
 * centre still renders; anything from the API is genuine output.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type RealReportType, type ReportDto } from '@/services/api';
import { reportTypes } from '@/data/reportsData';
import type { ReportTypeId } from '@/types/reports';

/** Map the UI report-type id to the backend report family. */
export function uiTypeToBackend(uiType: ReportTypeId): RealReportType {
  switch (uiType) {
    case 'watchlist-activity':
    case 'alert-summary':
      return 'watchlist_alerts';
    case 'camera-health':
    case 'daily-operations':
      return 'camera_health';
    case 'cross-camera-journey':
      return 'investigation';
    case 'traffic-analytics':
      return 'anpr_activity';
    case 'vehicle-intelligence':
    default:
      return 'anpr_activity';
  }
}

/** Map a backend report family back to a UI report-type id. */
export function backendToUiType(t: string): ReportTypeId {
  switch (t) {
    case 'watchlist_alerts':
      return 'watchlist-activity';
    case 'camera_health':
      return 'camera-health';
    case 'investigation':
      return 'cross-camera-journey';
    case 'vehicle_journey':
      return 'cross-camera-journey';
    case 'anpr_activity':
    default:
      return 'vehicle-intelligence';
  }
}

function formatGeneratedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function sizeMb(bytes: number | null): number | null {
  if (!bytes) return null;
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

export interface RealReportView {
  raw: ReportDto;
  id: string;
  name: string;
  type: ReportTypeId;
  generatedAt: string;
  createdBy: string;
  creatorRank: string;
  status: 'completed' | 'generating' | 'pending' | 'failed';
  sizeMb: number | null;
  format: 'PDF' | 'CSV' | 'XLSX';
  pages: number;
  classification: 'restricted' | 'internal' | 'confidential';
  scope: string;
  cameras: number;
  records: number;
}

export function toView(raw: ReportDto): RealReportView {
  return {
    raw,
    id: raw.report_id,
    name: raw.name,
    type: backendToUiType(raw.type),
    generatedAt: formatGeneratedAt(raw.created_at),
    createdBy: raw.created_by ?? 'system',
    creatorRank: raw.created_by_role ?? '',
    status: raw.status === 'completed' ? 'completed' : raw.status === 'failed' ? 'failed' : 'generating',
    sizeMb: sizeMb(raw.file_size_bytes),
    format: raw.format === 'CSV' ? 'CSV' : raw.format === 'XLSX' ? 'XLSX' : 'PDF',
    pages: 0,
    classification:
      raw.classification === 'restricted' || raw.classification === 'confidential'
        ? raw.classification
        : 'internal',
    scope: raw.camera_id ?? (raw.plate ? `Plate ${raw.plate}` : 'Gujarat — all cameras'),
    cameras: raw.camera_count ?? 0,
    records: raw.row_count ?? 0,
  };
}

export interface GenerateArgs {
  uiType: ReportTypeId;
  name: string;
  format?: string;
  classification?: string;
  camera?: string;
  plate?: string;
  severity?: string;
}

export function useReports() {
  const [reports, setReports] = useState<RealReportView[]>([]);
  const [backendLive, setBackendLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const page = await api.getReports({ limit: 100 });
      setReports(page.items.map(toView));
      setBackendLive(true);
    } catch {
      setBackendLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll while any report is still rendering.
    timer.current = window.setInterval(() => {
      setReports((prev) => {
        if (prev.some((r) => r.status === 'generating' || r.status === 'pending')) {
          void load();
        }
        return prev;
      });
    }, 4000);
    return () => window.clearInterval(timer.current);
  }, [load]);

  const generate = useCallback(
    async (args: GenerateArgs): Promise<RealReportView | null> => {
      try {
        const created = await api.generateReport({
          type: uiTypeToBackend(args.uiType),
          name: args.name,
          format: args.format ?? 'CSV',
          classification: args.classification ?? 'internal',
          camera_id: args.camera && args.camera !== 'All Cameras' ? args.camera : null,
          plate: args.plate || null,
        });
        const view = toView(created);
        setReports((prev) => [view, ...prev]);
        setBackendLive(true);
        // Refresh to pick up completed rows + file size.
        void load();
        return view;
      } catch {
        setBackendLive(false);
        return null;
      }
    },
    [load],
  );

  const downloadUrl = useCallback((reportId: string) => api.reportDownloadUrl(reportId), []);

  return { reports, backendLive, loading, load, generate, downloadUrl, reportTypes };
}
