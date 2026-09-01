/* Dev-only runtime smoke check for the Analytics screen (page + report drawer)
   through react-dom/server so every new component's render path runs.
   Usage: npx vite build --ssr scripts/analytics-smoke.tsx --outDir /tmp/ssr-analytics --emptyOutDir && node /tmp/ssr-analytics/analytics-smoke.js */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { DetailedReportDrawer } from '@/components/analytics/DetailedReportDrawer';
import { computeAnalytics, defaultAnalyticsFilters } from '@/data/analyticsData';
import { Analytics } from '@/pages/Analytics';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

const page = renderToString(
  <MemoryRouter>
    <Analytics />
  </MemoryRouter>,
);

const snapshot = computeAnalytics(defaultAnalyticsFilters);
const drawer = renderToString(
  <MemoryRouter>
    <DetailedReportDrawer snapshot={snapshot} onClose={() => undefined} onExport={() => undefined} />
  </MemoryRouter>,
);

assert(page.includes('AI Analytics'), 'header title');
assert(page.includes('Real-time CCTV intelligence, detection trends and operational insights'), 'subtitle');
assert(page.includes('Export Report') && page.includes('Refresh'), 'top actions');
assert(page.includes('Date range') || page.includes('Today · 01 Sep'), 'date range control');

assert(page.includes('Vehicles Detected') && page.includes('18,729'), 'KPI vehicles 18,729');
assert(page.includes('ANPR Reads') && page.includes('14,382'), 'KPI ANPR 14,382');
assert(page.includes('AI Events') && page.includes('2,846'), 'KPI AI events 2,846');
assert(page.includes('Watchlist Matches'), 'KPI watchlist');
assert(page.includes('Active Cameras') && page.includes('11,243'), 'KPI cameras 11,243');

assert(page.includes('Vehicle Detection Trend'), 'trend chart');
assert(page.includes('Vehicle Types') && page.includes('Cars') && page.includes('Two Wheelers'), 'vehicle types');
assert(page.includes('Heavy Vehicles') && page.includes('Buses'), 'heavy + buses');
assert(page.includes('AI Events by Type'), 'events chart');
assert(page.includes('Speed Violation') && page.includes('Wrong Direction') && page.includes('Crowd Detected'), 'event types');
assert(page.includes('No Helmet') && page.includes('Signal Jump') && page.includes('Other Events'), 'helmet/signal/other');
assert(page.includes('ANPR Performance') && page.includes('Plates processed'), 'ANPR panel');
assert(page.includes('Successful reads') && page.includes('OCR confidence') && page.includes('Unreadable plates'), 'ANPR metrics');
assert(page.includes('Camera Activity') && page.includes('C-115') && page.includes('C-038'), 'camera activity');
assert(page.includes('Top Detection Locations'), 'locations panel');
assert(
  page.includes('Gift City Road') &&
    page.includes('S.G. Highway') &&
    page.includes('Shahibaug Road') &&
    page.includes('Naranpura Road') &&
    page.includes('Vadodara City Center'),
  'required locations',
);
assert(page.includes('Watchlist Match Trend'), 'watchlist trend');
assert(page.includes('Hourly Activity'), 'heatmap');
assert(page.includes('Intelligence Summary') && page.includes('View Detailed Report'), 'intelligence panel');
assert(page.includes('Peak traffic period') && page.includes('Highest detection location'), 'insights');
assert(page.includes('GJ01AB1234'), 'watchlist unusual activity');

assert(snapshot.kpis.vehicles === 18729, 'snapshot vehicles');
assert(snapshot.kpis.anpr === 14382, 'snapshot anpr');
assert(snapshot.kpis.events === 2846, 'snapshot events');
assert(snapshot.kpis.watchlist === 7, 'snapshot watchlist');
assert(snapshot.kpis.cameras === 11243, 'snapshot cameras');
assert(snapshot.vehicleTypes.reduce((acc, slice) => acc + slice.value, 0) === 18729, 'types sum to vehicles');
assert(snapshot.eventTypes.reduce((acc, bar) => acc + bar.value, 0) === 2846, 'events sum');

assert(drawer.includes('Intelligence Briefing'), 'drawer title');
assert(drawer.includes('Operational snapshot') && drawer.includes('Narrative'), 'drawer sections');

console.log(failed === 0 ? 'SSR SMOKE PASS' : `SSR SMOKE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
