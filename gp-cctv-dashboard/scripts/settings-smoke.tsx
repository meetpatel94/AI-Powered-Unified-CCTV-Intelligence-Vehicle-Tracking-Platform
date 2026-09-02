/* Dev-only runtime smoke check: renders the System Settings screen through
   react-dom/server so every new component's render path runs.
   Usage: npx vite build --ssr scripts/settings-smoke.tsx --outDir /tmp/ssr-out-settings --emptyOutDir && node /tmp/ssr-out-settings/settings-smoke.js */
import { renderToString } from 'react-dom/server';

import { SystemSettings } from '@/pages/SystemSettings';

let failed = 0;
const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`OK   ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

const page = renderToString(<SystemSettings />);

/* header identity + action cluster */
assert(page.includes('System Settings'), 'page title SYSTEM SETTINGS');
assert(page.includes('Configure CCTV, AI intelligence, alerts, security and platform operations'), 'page subtitle');
assert(page.includes('Save Changes') && page.includes('Reset') && page.includes('Apply Changes'), 'save/reset/apply buttons');
assert(page.includes('All Systems Operational'), 'status indicator');

/* section labels across all 14 modules */
const sections = [
  'Identity &amp; command',
  'RTSP ingest resilience',
  'Detection engine',
  'Recognition engine',
  'Tracker',
  'Real-time matching',
  'Viewport',
  'Console alerts',
  'Access policy',
  'Retention schedules',
  'Alert thresholds',
  'Session &amp; encryption',
  'Recording policy',
  'Maintenance policy',
];
for (const heading of sections) {
  assert(page.includes(heading), `section subhead — ${heading}`);
}

/* representative controls */
assert(page.includes('Platform name'), 'general row — platform name');
assert(page.includes('Connection timeout'), 'camera row — RTSP timeout');
assert(page.includes('Confidence threshold'), 'AI row — confidence');
assert(page.includes('OCR confidence threshold'), 'ANPR row — OCR confidence');
assert(page.includes('Cross-camera matching'), 'tracking row');
assert(page.includes('Alert priority levels'), 'watchlist row');
assert(page.includes('Default zoom level'), 'gis row');
assert(page.includes('Notification severity'), 'notifications row');
assert(page.includes('Role permission matrix'), 'RBAC matrix');
assert(page.includes('Evidence retention'), 'storage row');
assert(page.includes('Telemetry interval'), 'performance row');
assert(page.includes('Encryption at rest'), 'security row');
assert(page.includes('Activity ledger'), 'audit ledger');
assert(page.includes('Manual operations'), 'maintenance ops');

/* right rail + bottom history */
assert(page.includes('System Status') && page.includes('Stream Gateway'), 'system status rail');
assert(page.includes('Configuration Change History'), 'change history table');
assert(page.includes('Stream Gateway') && page.includes('Operational'), 'gateway operational');

/* overlays render */
assert(page.includes('Configuration') && page.includes('14 modules'), 'nav module count');

console.log(failed === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
