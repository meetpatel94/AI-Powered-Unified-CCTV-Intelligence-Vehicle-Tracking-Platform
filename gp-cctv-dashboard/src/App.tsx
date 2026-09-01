import { Navigate, Route, Routes } from 'react-router-dom';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { CameraMap } from '@/pages/CameraMap';
import { Dashboard } from '@/pages/Dashboard';
import { LiveView } from '@/pages/LiveView';
import { Watchlist } from '@/pages/Watchlist';

/**
 * App shell. Dashboard, Live View, Camera Map, Watchlist, Alerts and Analytics
 * are implemented; the remaining sidebar modules are inert placeholders until
 * they are built.
 */
export default function App() {
  return (
    <div className="flex h-screen min-w-[1360px] overflow-hidden bg-base-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live-view" element={<LiveView />} />
          <Route path="/camera-map" element={<CameraMap />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
