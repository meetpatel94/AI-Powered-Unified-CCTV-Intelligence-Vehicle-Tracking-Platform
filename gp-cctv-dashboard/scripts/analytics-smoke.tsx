/* Dev-only runtime smoke check for the reorganised Analytics screen
   (header/filters → KPIs → watchlist trend + AI events → GIS activity map →
   vehicle types + camera/activity insights) through react-dom/server so every
   component's render path runs.
   Usage: npx vite build --ssr scripts/analytics-smoke.tsx --outDir /tmp/ssr-analytics --emptyOutDir && node /tmp/ssr-analytics/analytics-smoke.js */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { AnalyticsActivityMap } from '@/components/analytics/AnalyticsActivityMap';
import { computeAnalytics, defaultAnalyticsFilters } from '@/data/analyticsData';
import { Analytics } from '@/pages/Analytics';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  };
};
void 0;

const page = renderToString(
  <MemoryRouter>
    <Analytics />
  </MemoryRouter>,
);

const snapshot = computeAnalytics(defaultAnalyticsFilters);
const map = renderToString(
  <MemoryRouter>
    <AnalyticsActivityMap snapshot={snapshot} onSelectCamera={() => undefined} />
  </MemoryRouter>,
);

/* 0 — header + filters */
assert(page.includes('AI Analytics'), 'header title');
assert(page.includes('Real-time CCTV intelligence, detection trends and operational insights'), 'subtitle');
assert(page.includes('Export Report') && page.includes('Refresh'), 'top actions');
assert(page.includes('Date range') || page.includes('Today · 01 Sep'), 'date range control');
assert(page.includes('All Gujarat'), 'location filter');

/* 1 — compact KPI cards */
assert(page.includes('Vehicles Detected') && page.includes('18,729'), 'KPI vehicles 18,729');
assert(page.includes('ANPR Reads') && page.includes('14,382'), 'KPI ANPR 14,382');
assert(page.includes('AI Events') && page.includes('2,846'), 'KPI AI events 2,846');
assert(page.includes('Watchlist Matches'), 'KPI watchlist');
assert(page.includes('Active Cameras') && page.includes('11,243'), 'KPI cameras 11,243');

/* 2 — watchlist match trend (left) + AI events by type (right) */
assert(page.includes('Watchlist Match Trend'), 'watchlist trend panel');
assert(page.includes('AI Events by Type'), 'AI events panel');
assert(
  page.includes('Speed Violation') && page.includes('Wrong Direction') && page.includes('Crowd Detected'),
  'event types',
);
assert(page.includes('No Helmet') && page.includes('Signal Jump') && page.includes('Other Events'), 'helmet/signal/other');

/* 3 — GIS / activity map */
assert(page.includes('GIS / Activity Map'), 'map panel title');
assert(map.includes('Gift City Road') && map.includes('S.G. Highway'), 'map detection-location labels');
assert(map.includes('C-038') || map.includes('watchlist'), 'map watchlist flag layer');
assert(map.includes('outside map extent') && map.includes('Kalawad Road'), 'map out-of-extent cameras');
assert(map.includes('AHMEDABAD'), 'map basemap labels');

/* 4 — vehicle type distribution + camera / activity insights */
assert(page.includes('Vehicle Types') && page.includes('Cars') && page.includes('Two Wheelers'), 'vehicle types');
assert(page.includes('Heavy Vehicles') && page.includes('Buses'), 'heavy + buses');
assert(page.includes('Camera / Activity Insights'), 'insights panel');
assert(page.includes('ANPR read quality') && page.includes('OCR confidence'), 'ANPR quality strip');
assert(page.includes('Most active cameras') && page.includes('C-115') && page.includes('C-038'), 'camera ranking');
assert(page.includes('Unusual activity') && page.includes('GJ01AB1234'), 'unusual activity flags');

/* removed low-value / duplicated panels stay gone */
assert(!page.includes('Vehicle Detection Trend'), 'vehicle detection trend removed');
assert(!page.includes('Hourly Activity'), 'heatmap removed');
assert(!page.includes('Intelligence Summary'), 'intelligence summary removed');
assert(!page.includes('Top Detection Locations'), 'top locations panel removed (now on the map)');
assert(!page.includes('View Detailed Report'), 'report drawer removed');

/* snapshot values unchanged */
assert(snapshot.kpis.vehicles === 18729, 'snapshot vehicles');
assert(snapshot.kpis.anpr === 14382, 'snapshot anpr');
assert(snapshot.kpis.events === 2846, 'snapshot events');
assert(snapshot.kpis.watchlist === 7, 'snapshot watchlist');
assert(snapshot.kpis.cameras === 11243, 'snapshot cameras');
assert(snapshot.vehicleTypes.reduce((acc, slice) => acc + slice.value, 0) === 18729, 'types sum to vehicles');
assert(snapshot.eventTypes.reduce((acc, bar) => acc + bar.value, 0) === 2846, 'events sum');

console.log(failed === 0 ? 'SSR SMOKE PASS' : `SSR SMOKE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
