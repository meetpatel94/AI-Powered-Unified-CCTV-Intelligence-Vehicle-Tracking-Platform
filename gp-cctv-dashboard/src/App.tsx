import { Navigate, Route, Routes } from 'react-router-dom';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { CameraHealth } from '@/pages/CameraHealth';
import { CameraMap } from '@/pages/CameraMap';
import { Dashboard } from '@/pages/Dashboard';
import { Investigation } from '@/pages/Investigation';
import { LiveView } from '@/pages/LiveView';
import { Reports } from '@/pages/Reports';
import { SystemSettings } from '@/pages/SystemSettings';
import { Users } from '@/pages/Users';
import { Watchlist } from '@/pages/Watchlist';

/**
 * App shell. Dashboard, Live View, Camera Map, Watchlist, Alerts, Analytics,
 * Investigation, Camera Health, Reports, Users & Roles and System Settings
 * are implemented; the remaining sidebar modules are inert placeholders
 * until they are built.
 *
 * Layout model: fixed sidebar + fixed header, main area takes the full
 * remaining width/height and scrolls vertically when content is taller than
 * the viewport. Pages use the `.page` / `.page-viewport` classes from
 * index.css for padding, gaps and overflow rules.
 */
export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-base-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live-view" element={<LiveView />} />
            <Route path="/camera-map" element={<CameraMap />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/camera-health" element={<CameraHealth />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users-roles" element={<Users />} />
            <Route path="/system-settings" element={<SystemSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
