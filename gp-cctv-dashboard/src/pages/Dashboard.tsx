import { AiAnalyticsPanel } from '@/components/dashboard/AiAnalyticsPanel';
import { CameraHealthPanel } from '@/components/dashboard/CameraHealthPanel';
import { GisCameraMapPanel } from '@/components/dashboard/GisCameraMapPanel';
import { JourneyTimelinePanel } from '@/components/dashboard/JourneyTimelinePanel';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { LiveFeedsPanel } from '@/components/dashboard/LiveFeedsPanel';
import { RecentAlertsPanel } from '@/components/dashboard/RecentAlertsPanel';
import { VehicleSearchPanel } from '@/components/dashboard/VehicleSearchPanel';

/**
 * Operational dashboard: KPI strip, live wall + GIS map + alert rail,
 * then the vehicle intelligence row. Content scrolls the page when it is
 * taller than the viewport; bands use minmax() grid columns so panels
 * reflow instead of shrinking below readable sizes.
 */
export function Dashboard() {
  return (
    <div className="page">
      <KpiRow />

      {/* Situational awareness row */}
      <div
        className="responsive-band responsive-band-main grid shrink-0 gap-[var(--page-gap)] grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(300px,34fr)_minmax(340px,39fr)_minmax(300px,27fr)]"
      >
        <div className="min-w-0">
          <LiveFeedsPanel />
        </div>
        <div className="min-w-0">
          <GisCameraMapPanel />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-[var(--page-gap)] md:col-span-2 sm:grid-cols-2 xl:flex xl:col-span-1 xl:flex-col">
          <div className="min-h-0 min-w-0 xl:flex-1">
            <RecentAlertsPanel />
          </div>
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <CameraHealthPanel />
          </div>
        </div>
      </div>

      {/* Vehicle intelligence row */}
      <div
        className="responsive-band responsive-band-mid grid shrink-0 gap-[var(--page-gap)] grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(250px,20fr)_minmax(380px,47fr)_minmax(300px,33fr)]"
      >
        <div className="min-w-0">
          <VehicleSearchPanel />
        </div>
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <JourneyTimelinePanel />
        </div>
        <div className="min-w-0">
          <AiAnalyticsPanel />
        </div>
      </div>
    </div>
  );
}
