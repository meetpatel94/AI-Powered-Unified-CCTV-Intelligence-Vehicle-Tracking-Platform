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
 * then the vehicle intelligence row.
 */
export function Dashboard() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <KpiRow />

      {/* Situational awareness row */}
      <div className="flex h-[464px] shrink-0 gap-3">
        <div className="w-[34%] min-w-0">
          <LiveFeedsPanel />
        </div>
        <div className="w-[39%] min-w-0">
          <GisCameraMapPanel />
        </div>
        <div className="flex w-[27%] min-w-0 flex-col gap-3">
          <RecentAlertsPanel />
          <CameraHealthPanel />
        </div>
      </div>

      {/* Vehicle intelligence row */}
      <div className="flex h-[280px] shrink-0 gap-3">
        <div className="w-[20%] min-w-0">
          <VehicleSearchPanel />
        </div>
        <div className="w-[47%] min-w-0">
          <JourneyTimelinePanel />
        </div>
        <div className="w-[33%] min-w-0">
          <AiAnalyticsPanel />
        </div>
      </div>
    </div>
  );
}
