/* Dev-only runtime smoke check for the Alerts screen (page + details panel)
   through react-dom/server so every new component's render path runs.
   Usage: npx vite build --ssr scripts/alerts-smoke.tsx --outDir /tmp/ssr-alerts --emptyOutDir && node /tmp/ssr-alerts/alerts-smoke.js */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { AlertDetailsPanel } from '@/components/alerts/AlertDetailsPanel';
import { alerts } from '@/data/alertsData';
import { Alerts } from '@/pages/Alerts';

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
    <Alerts />
  </MemoryRouter>,
);
const drawer = renderToString(
  <MemoryRouter>
    <AlertDetailsPanel alert={alerts[0]} onClose={() => undefined} onAction={() => undefined} />
  </MemoryRouter>,
);

/* page chrome */
assert(page.includes('Alert Management'), 'header title');
assert(page.includes('Real-time AI detection, watchlist matches and incident response'), 'subtitle');
assert(page.includes('Refresh') && page.includes('Export') && page.includes('Mark All Reviewed'), 'top actions');

/* KPI values */
assert(page.includes('>23<') && page.includes('Total Alerts'), 'KPI total 23');
assert(page.includes('Critical') && page.includes('>4<'), 'KPI critical 4');
assert(page.includes('High Priority') && page.includes('>7<'), 'KPI high 7');
assert(page.includes('Medium') && page.includes('>8<'), 'KPI medium 8');
assert(page.includes('Resolved') && page.includes('>4<'), 'KPI resolved 4');

/* filters */
assert(page.includes('All Alerts') && page.includes('Unreviewed') && page.includes('In Progress'), 'quick scopes');
assert(
  page.includes('All Severities') && page.includes('All Alert Types') && page.includes('All Cameras / Locations') && page.includes('All Statuses'),
  'filter selects',
);

/* feed content */
assert(page.includes('GJ01AB1234') && page.includes('Watchlist Match'), 'watchlist match card');
assert(page.includes('GJ05JK6789') && page.includes('Speed Violation'), 'speed card');
assert(page.includes('GJ18CD4521') && page.includes('Wrong Direction'), 'wrong-direction card');
assert(page.includes('Crowd') && page.includes('C-089'), 'crowd card');
assert(alerts.length === 23, '23 seeded alerts');

/* bottom analytics + rails */
assert(page.includes('Alerts by Type') && page.includes('Alerts Over Time'), 'analytics charts');
assert(page.includes('Severity Distribution') && page.includes('Top Alert Locations'), 'donut + locations');
assert(page.includes('Live Activity') && page.includes('Response Timeline'), 'right rail panels');

/* details panel */
assert(drawer.includes('Detection Telemetry') && drawer.includes('Related Cameras'), 'details sections');
assert(drawer.includes('Vehicle Journey') && drawer.includes('sightings'), 'journey strip');
assert(
  drawer.includes('Acknowledge') && drawer.includes('Investigate') && drawer.includes('Track Vehicle') && drawer.includes('View Camera') && drawer.includes('Escalate') && drawer.includes('Resolve'),
  'action buttons',
);
assert(drawer.includes('98.7%') && drawer.includes('CR-114/2026'), 'confidence + case ref');

process.exit(failed === 0 ? 0 : 1);
