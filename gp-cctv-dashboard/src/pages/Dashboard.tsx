import { AiAnalyticsPanel } from '@/components/dashboard/AiAnalyticsPanel';
import { GisCameraMapPanel } from '@/components/dashboard/GisCameraMapPanel';
import { JourneyTimelinePanel } from '@/components/dashboard/JourneyTimelinePanel';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { LiveFeedsPanel } from '@/components/dashboard/LiveFeedsPanel';
import { RecentAlertsPanel } from '@/components/dashboard/RecentAlertsPanel';
import { VehicleSearchPanel } from '@/components/dashboard/VehicleSearchPanel';
import {
  useAiActivity,
  useDashboardKpis,
  useGisMapCameras,
  useJourneyTimeline,
  useRecentAlerts,
} from '@/hooks/useIntelligence';

/**
 * Operational dashboard: KPI strip on top, then three two-column
 * command-center bands — live wall + GIS map, recent alerts + vehicle
 * search, vehicle journey + AI analytics. Camera Health is intentionally
 * not part of this layout; it has its own sidebar screen (`/camera-health`).
 *
 * Every band pulls from the FastAPI backend when it is reachable
 * (`hooks/useIntelligence.ts`); the panels fall back to their bundled mock
 * fixtures otherwise. Layout rules: each band is a CSS grid that stacks to a
 * single column below `xl` and splits into two equal `minmax(0,1fr)`-style
 * columns on desktop, with `min-w-0` on every cell so nothing overflows
 * horizontally. Panels are not force-stretched to one shared height — a band
 * is only as tall as its tallest panel's own content, and the live wall uses
 * `xl:self-start` so it hugs its 2 x 2 grid instead of stretching to match
 * the map. The GIS map and the AI chart have no intrinsic height (their
 * bodies are absolutely positioned layers), so those two cells are single-cell
 * grids with a pixel minimum (`min-h-[420px]` / `min-h-[300px]`) that the
 * panel fills by stretching; no band or cell uses viewport units.
 */
export function Dashboard() {
  const { stats: kpis } = useDashboardKpis();
  const { items: alerts } = useRecentAlerts();
  const { stops, plate, live: journeyLive } = useJourneyTimeline();
  const { bars } = useAiActivity();
  const { cameras: gisCameras } = useGisMapCameras();

  return (
    <div className="page">
      <KpiRow stats={kpis} />

      {/* Row 1 — Live CCTV wall (left) + GIS camera map (right) */}
      <div className="responsive-band grid shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-2">
        <div className="min-w-0 xl:self-start">
          <LiveFeedsPanel />
        </div>
        <div className="grid min-h-[420px] min-w-0">
          <GisCameraMapPanel cameras={gisCameras ?? undefined} />
        </div>
      </div>

      {/* Row 2 — Recent alerts (left) + vehicle search (right) */}
      <div className="responsive-band grid shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-2">
        <div className="min-w-0">
          <RecentAlertsPanel alerts={alerts} />
        </div>
        <div className="min-w-0">
          <VehicleSearchPanel />
        </div>
      </div>

      {/* Row 3 — Vehicle journey (left) + AI analytics (right) */}
      <div className="responsive-band grid shrink-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-2">
        <div className="min-w-0">
          <JourneyTimelinePanel stops={stops} plate={journeyLive ? plate : undefined} />
        </div>
        <div className="grid min-h-[300px] min-w-0">
          <AiAnalyticsPanel bars={bars ?? undefined} />
        </div>
      </div>
    </div>
  );
}
