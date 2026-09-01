/* Dev-only runtime smoke check for the Camera Health & Stream Monitoring
   console: renders the page plus every panel through react-dom/server and
   asserts the derived numbers, then re-renders the seven pre-existing screens
   to prove the shared shell and the other workspaces are untouched.
   Usage: npx vite build --ssr scripts/camerahealth-smoke.tsx --outDir node_modules/.ssr-camerahealth --emptyOutDir \
          && node node_modules/.ssr-camerahealth/camerahealth-smoke.js */
import type { ReactElement } from 'react';

import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import App from '@/App';
import { CameraHealthSettingsModal } from '@/components/camerahealth/CameraHealthSettingsModal';
import { CriticalCamerasPanel } from '@/components/camerahealth/CriticalCamerasPanel';
import { HealthByLocationPanel } from '@/components/camerahealth/HealthByLocationPanel';
import { RecentHealthEventsPanel } from '@/components/camerahealth/RecentHealthEventsPanel';
import { SelectedCameraHealthPanel } from '@/components/camerahealth/SelectedCameraHealthPanel';
import { StatusDistributionPanel } from '@/components/camerahealth/StatusDistributionPanel';
import { StreamQualityPanel } from '@/components/camerahealth/StreamQualityPanel';
import {
  criticalCameras,
  defaultHealthFilters,
  defaultHealthSettings,
  evaluateCamera,
  filterCameras,
  fleetHealth,
  fleetReadout,
  healthCameras,
  healthEvents,
  healthReportCsv,
  liveCamera,
  locationHealth,
  sortCameras,
  statusCounts,
  statusSlices,
  streamQualitySeries,
  streamQualitySummary,
} from '@/data/cameraHealthData';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { CameraHealth } from '@/pages/CameraHealth';
import { CameraMap } from '@/pages/CameraMap';
import { Dashboard } from '@/pages/Dashboard';
import { Investigation } from '@/pages/Investigation';
import { LiveView } from '@/pages/LiveView';
import { Watchlist } from '@/pages/Watchlist';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

/** react-dom/server splits text nodes with comments — flatten before matching. */
const flat = (html: string) => html.replace(/<!-- -->/g, '');

const settings = defaultHealthSettings;

/* ---------------- page render ---------------- */

const page = flat(
  renderToString(
    <MemoryRouter>
      <CameraHealth />
    </MemoryRouter>,
  ),
);

assert(page.includes('Camera Health'), 'page title renders CAMERA HEALTH');
assert(page.includes('Monitor camera connectivity, stream quality and AI processing health'), 'subtitle matches the brief');
assert(page.includes('stream monitoring'), 'workspace badge renders');

/* header controls */
assert(page.includes('Refresh'), 'Refresh control present');
assert(page.includes('Auto Refresh'), 'Auto Refresh control present');
assert(page.includes('Export Report'), 'Export Report control present');
assert(page.includes('Settings'), 'Settings control present');

/* KPI strip — the exact fleet numbers from the brief */
assert(page.includes('Total Cameras'), 'KPI Total Cameras present');
assert(page.includes('12,842'), 'KPI shows 12,842 total cameras');
assert(page.includes('11,243'), 'KPI shows 11,243 online');
assert(page.includes('1,128'), 'KPI shows 1,128 offline');
assert(page.includes('471'), 'KPI shows 471 poor signal');
assert(page.includes('86'), 'KPI shows 86 reconnecting');
assert(page.includes('87%') && page.includes('9%') && page.includes('4%'), 'KPI percentages 87% / 9% / 4% render');
assert(page.includes('of 471 poor-signal · retrying now'), 'reconnecting card is labelled as a poor-signal sub-state');

/* toolbar */
['All Cameras', 'Online', 'Offline', 'Poor Signal', 'Reconnecting', 'Critical'].forEach((chip) =>
  assert(page.includes(chip), `filter chip "${chip}" present`),
);
assert(page.includes('All departments') && page.includes('All locations'), 'department + location filters present');
assert(page.includes('All codecs') && page.includes('All resolutions'), 'codec + resolution filters present');
assert(page.includes('Search camera ID, location, area, IP…'), 'search box present');
assert(page.includes('Status (worst first)'), 'sort control present');

/* monitor grid */
assert(page.includes('Camera Health Monitor'), 'CAMERA HEALTH MONITOR panel renders');
['Camera ID', 'Location', 'Department', 'Status', 'Stream', 'Resolution', 'Codec', 'Latency', 'Bitrate', 'Packet Loss', 'Last Heartbeat', 'AI / ANPR', 'Health'].forEach(
  (column) => assert(page.includes(column), `monitor column "${column}" present`),
);

const required = ['C-001', 'C-007', 'C-015', 'C-038', 'C-089', 'C-115', 'C-207'];
required.forEach((id) => assert(page.includes(id), `required camera ${id} is monitored`));
assert(page.includes('Shahibaug Road') && page.includes('Naranpura Road') && page.includes('Kudasan Road'), 'named Ahmedabad / Gandhinagar locations render');
assert(page.includes('Gift City Road') && page.includes('Maninagar Junction') && page.includes('S.G. Highway'), 'named special-ops / crime-branch locations render');
assert(page.includes('Vadodara City Center'), 'Vadodara camera renders');
assert(page.includes('H.264') && page.includes('H.265'), 'codec column shows H.264 and H.265');
assert(page.includes('1920x1080') && page.includes('2560x1440'), 'resolution column shows 1080p and 1440p');
assert(page.includes('RTSP live') && page.includes('Stream lost'), 'stream transport states render');
assert(page.includes('Traffic Branch') && page.includes('Highway Patrol') && page.includes('Special Ops'), 'departments render');

/* right-side inspector (defaults to C-001) */
assert(page.includes('Selected Camera Health'), 'SELECTED CAMERA HEALTH panel renders');
['Restart Stream', 'View Live', 'Snapshot'].forEach((action) => assert(page.includes(action), `inspector action "${action}" present`));
assert(page.includes('Ingest pipeline') && page.includes('RTSP') && page.includes('WebRTC') && page.includes('HLS'), 'RTSP / WebRTC / HLS states render');
assert(page.includes('AI / ANPR pipeline') && page.includes('yolo-v8-traffic'), 'AI + ANPR pipeline block renders');
assert(page.includes('Last heartbeat') && page.includes('Uptime'), 'heartbeat + uptime specs render');
assert(page.includes('Subsystems nominal'), 'C-001 evaluates as nominal by default');

/* analytics + distribution + events + critical */
assert(page.includes('Stream Quality') && page.includes('FPS trend') && page.includes('Latency trend') && page.includes('Bitrate trend') && page.includes('Packet loss'), 'STREAM QUALITY panel renders all four charts');
assert(page.includes('Camera Status Distribution'), 'status distribution panel renders');
assert(page.includes('Health By Location'), 'health by location panel renders');
assert(page.includes('Recent Health Events'), 'recent health events panel renders');
assert(page.includes('Critical Cameras'), 'critical cameras panel renders');
assert(page.includes('feeds need action'), 'critical panel shows its action count');

/* ---------------- pure data layer ---------------- */

const slices = statusSlices(fleetHealth);
const primary = slices.filter((slice) => !slice.subsetOf);
assert(
  primary.reduce((sum, slice) => sum + slice.count, 0) === fleetHealth.total,
  'online + offline + poor is an exact partition of the fleet',
);
assert(
  primary.reduce((sum, slice) => sum + slice.whole, 0) === 100,
  'integer shares of the three primary buckets total exactly 100%',
);
assert(
  primary.map((slice) => slice.whole).join('/') === '87/9/4',
  'integer shares are 87% online / 9% offline / 4% poor (largest remainder)',
);
const reconnecting = slices.find((slice) => slice.id === 'reconnecting');
assert(reconnecting?.count === 86 && reconnecting.subsetOf === 'Poor Signal', 'reconnecting 86 is modelled inside the poor-signal bucket');

const counts = statusCounts(healthCameras);
assert(counts.all === healthCameras.length && counts.all > 20, `monitor grid carries ${counts.all} feeds`);
assert(counts.offline === 1 && counts.critical === 3 && counts.reconnecting === 2, 'monitored set mixes online / poor / reconnecting / critical / offline');

const c001 = healthCameras.find((camera) => camera.id === 'C-001')!;
const c160 = healthCameras.find((camera) => camera.id === 'C-160')!;
const c038 = healthCameras.find((camera) => camera.id === 'C-038')!;
const c131 = healthCameras.find((camera) => camera.id === 'C-131')!;

assert(evaluateCamera(c001, settings).score === 100 && evaluateCamera(c001, settings).tone === 'green', 'healthy camera scores 100 / green');
assert(evaluateCamera(c160, settings).score === 0 && evaluateCamera(c160, settings).tone === 'red', 'offline camera scores 0 / red');
assert(evaluateCamera(c038, settings).tone === 'red', 'critical camera never renders green');
assert(evaluateCamera(c131, settings).tone === 'cyan', 'reconnecting camera renders the blue state');
assert(evaluateCamera(c038, settings).reasons.some((reason) => reason.includes('queue depth')), 'critical camera reports its AI queue backlog');

const strict = { ...settings, latencyWarnMs: 100, lossWarnPct: 0.05, fpsMinPct: 100, heartbeatWarnSec: 1 };
const strictFlagged = healthCameras.filter((camera) => evaluateCamera(camera, strict).attention).length;
const defaultFlagged = healthCameras.filter((camera) => evaluateCamera(camera, settings).attention).length;
const c015 = healthCameras.find((camera) => camera.id === 'C-015')!;
assert(
  strictFlagged > defaultFlagged && !evaluateCamera(c015, strict).attention,
  `tightening the thresholds flags more cameras (${defaultFlagged} → ${strictFlagged}) while the cleanest feed stays green`,
);

const h265 = filterCameras(healthCameras, { ...defaultHealthFilters, codec: 'H.265' });
assert(h265.length > 0 && h265.every((camera) => camera.codec === 'H.265'), 'codec filter returns only H.265 feeds');
const search = filterCameras(healthCameras, { ...defaultHealthFilters, query: 'shahibaug' });
assert(search.length === 1 && search[0].id === 'C-001', 'search matches a location name to its camera');
const offlineOnly = filterCameras(healthCameras, { ...defaultHealthFilters, status: 'offline' });
assert(offlineOnly.length === 1 && offlineOnly[0].id === 'C-160', 'status filter isolates the offline camera');

const byLatency = sortCameras(healthCameras, 'latency', 'desc', settings);
assert(byLatency[0].latencyMs >= byLatency[byLatency.length - 1].latencyMs, 'latency sort orders worst first');
const byWorst = sortCameras(healthCameras, 'status', 'asc', settings);
assert(byWorst[0].status === 'critical', 'default sort puts critical feeds on top');

const locations = locationHealth(healthCameras, settings);
assert(locations.length > 8 && locations[0].score <= locations[locations.length - 1].score, 'location ranking is worst-first');
assert(locations[0].label === 'Aslali' && locations[0].down === 1, 'Aslali (the offline camera) ranks worst');

const critical = criticalCameras(healthCameras, settings);
assert(critical[0].cameraId === 'C-160' && critical[0].durationMin === 38, 'longest-running incident leads the critical list');
assert(critical.every((item) => item.action.length > 0), 'every critical feed carries a remediation action');
assert(critical.find((item) => item.cameraId === 'C-038')?.action === 'Re-pair ANPR', 'ANPR queue backlog asks for an ANPR re-pair');

const summary = streamQualitySummary(streamQualitySeries);
assert(streamQualitySeries.fps.length === 24, 'quality series holds 24 five-minute buckets');
assert(summary.latency.peak.value === 340, 'latency peak of 340 ms is reported');
assert(summary.loss.peak.value === 2.1, 'packet-loss peak of 2.1% is reported');

const csv = healthReportCsv(healthCameras, settings).split('\n');
assert(csv.length === healthCameras.length + 1, 'CSV export has one row per monitored camera');
assert(csv[0].startsWith('camera_id,location,area,city') && csv[0].includes('anpr_active'), 'CSV header carries the technical columns');
assert(csv.some((row) => row.startsWith('C-001,Shahibaug Road')), 'CSV includes C-001 Shahibaug Road');

const frozen = liveCamera(c001, 0);
assert(frozen === c001, 'telemetry stays frozen while auto-refresh is paused (tick 0)');
assert(liveCamera(c001, 7).fps !== c001.fps || liveCamera(c001, 7).latencyMs !== c001.latencyMs, 'telemetry drifts when the console is live');
assert(liveCamera(c160, 7).fps === 0, 'an offline camera never drifts back to life');

const readout = fleetReadout(healthCameras, settings);
assert(readout.monitored === healthCameras.length && readout.attention >= 8, 'console readout aggregates the monitored set');
assert(healthEvents.length >= 12 && healthEvents[0].seconds >= healthEvents[healthEvents.length - 1].seconds, 'health events are ordered newest first');

/* ---------------- standalone panels ---------------- */

const inspector = flat(
  renderToString(
    <MemoryRouter>
      <SelectedCameraHealthPanel
        camera={c160}
        evaluation={evaluateCamera(c160, settings)}
        tick={0}
        busy={false}
        onRestart={() => undefined}
        onSnapshot={() => undefined}
      />
    </MemoryRouter>,
  ),
);
assert(inspector.includes('no video signal'), 'offline camera shows the no-signal preview');
assert(inspector.includes('timeout') && inspector.includes('unavailable'), 'offline camera reports failed RTSP / WebRTC / HLS');
assert(inspector.includes('Requires attention'), 'offline camera lists what needs attention');

const donut = flat(
  renderToString(
    <MemoryRouter>
      <StatusDistributionPanel fleet={fleetHealth} active="all" onSelect={() => undefined} />
    </MemoryRouter>,
  ),
);
assert(donut.includes('12,842') && donut.includes('87% up'), 'donut centre shows the fleet total and uptime share');
assert(donut.includes('Reconnecting') && donut.includes('of Poor Signal'), 'donut legend carries the reconnecting sub-state');
assert(donut.includes('partition the full fleet'), 'donut explains that the sub-states are not extra cameras');

const ranking = flat(
  renderToString(
    <MemoryRouter>
      <HealthByLocationPanel rows={locations} onDrill={() => undefined} />
    </MemoryRouter>,
  ),
);
assert(ranking.includes('Aslali') && ranking.includes('ranked worst first'), 'location panel renders the worst area first');

const criticalPanel = flat(
  renderToString(
    <MemoryRouter>
      <CriticalCamerasPanel items={critical} busyId="C-160" onAct={() => undefined} onSelect={() => undefined} selectedId="C-160" />
    </MemoryRouter>,
  ),
);
assert(criticalPanel.includes('Working…'), 'critical action button shows its busy state');
assert(criticalPanel.includes('Restart Stream') && criticalPanel.includes('Re-pair ANPR'), 'critical panel offers the right remediation per feed');

const events = flat(
  renderToString(
    <MemoryRouter>
      <RecentHealthEventsPanel events={healthEvents} onSelectCamera={() => undefined} selectedId={null} />
    </MemoryRouter>,
  ),
);
['Disconnected', 'Reconnecting', 'Poor signal', 'Stream recovered', 'Codec change'].forEach((kind) =>
  assert(events.includes(kind), `event kind "${kind}" is in the timeline filter`),
);
assert(events.includes('GP-FIELD-4471'), 'timeline carries the offline camera field ticket');

const quality = flat(
  renderToString(
    <MemoryRouter>
      <StreamQualityPanel series={streamQualitySeries} settings={settings} />
    </MemoryRouter>,
  ),
);
assert(quality.includes('warn 300 ms') && quality.includes('warn 1%'), 'quality charts overlay the configured thresholds');
assert(quality.includes('08:50') && quality.includes('10:45'), 'quality window label spans the last two hours');

const modal = flat(
  renderToString(
    <MemoryRouter>
      <CameraHealthSettingsModal open settings={settings} cameras={healthCameras} onClose={() => undefined} onApply={() => undefined} />
    </MemoryRouter>,
  ),
);
assert(modal.includes('Health Thresholds &amp; Polling'), 'settings modal renders');
assert(modal.includes('Latency warn') && modal.includes('Packet loss warn') && modal.includes('Min FPS'), 'settings modal exposes the thresholds');
assert(modal.includes('Live impact'), 'settings modal previews how many feeds the thresholds would flag');
assert(modal.includes('Restore defaults') && modal.includes('Apply thresholds'), 'settings modal has restore + apply controls');

/* ---------------- no regression on the other screens ---------------- */

const screens: Array<[string, string, () => ReactElement]> = [
  ['Dashboard', 'GIS Camera Map', () => <Dashboard />],
  ['Live View', 'Live CCTV Monitoring', () => <LiveView />],
  ['Camera Map', 'Legend', () => <CameraMap />],
  ['Watchlist', 'Watchlist Management', () => <Watchlist />],
  ['Alerts', 'Alert Management', () => <Alerts />],
  ['Analytics', 'AI Analytics', () => <Analytics />],
  ['Investigation', 'Investigation', () => <Investigation />],
];

screens.forEach(([name, marker, render]) => {
  const html = flat(renderToString(<MemoryRouter>{render()}</MemoryRouter>));
  assert(html.includes(marker), `${name} screen still renders (${marker})`);
});

const dashboard = flat(renderToString(<MemoryRouter><Dashboard /></MemoryRouter>));
assert(dashboard.includes('Camera Health'), 'dashboard camera-health donut still renders');

/* ---------------- app shell wiring ---------------- */

const app = flat(
  renderToString(
    <MemoryRouter initialEntries={['/camera-health']}>
      <App />
    </MemoryRouter>,
  ),
);
assert(app.includes('href="/camera-health"'), 'sidebar Camera Health entry is a live link');
assert(app.includes('Camera Health Monitor'), '/camera-health resolves inside the shared shell');
assert(app.includes('Live CCTV Monitoring') === false, 'no other screen leaks into the camera-health route');

console.log(failed === 0 ? 'CAMERA HEALTH SMOKE PASS' : `CAMERA HEALTH SMOKE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
