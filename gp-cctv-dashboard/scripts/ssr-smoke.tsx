/* Dev-only runtime smoke check: renders the Watchlist screen (page + drawer +
   modal) through react-dom/server so every new component's render path runs.
   Usage: npx vite build --ssr scripts/ssr-smoke.tsx --outDir /tmp/ssr-out --emptyOutDir && node /tmp/ssr-out/ssr-smoke.js */
import { renderToString } from 'react-dom/server';

import { AddWatchlistModal } from '@/components/watchlist/AddWatchlistModal';
import { EntryDrawer } from '@/components/watchlist/EntryDrawer';
import { watchlistEntries } from '@/data/watchlistData';
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

const page = renderToString(<Watchlist />);
const drawer = renderToString(
  <EntryDrawer entry={watchlistEntries[0]} onClose={() => undefined} />,
);
const modal = renderToString(
  <AddWatchlistModal open onClose={() => undefined} onCreate={() => undefined} />,
);

/* page chrome */
assert(page.includes('Watchlist Management'), 'header title');
assert(page.includes('Add to Watchlist'), 'add action');
assert(page.includes('Import') && page.includes('Export'), 'import/export actions');

/* KPI values */
assert(page.includes('Total Watchlist Entries') && page.includes('>248<'), 'KPI total 248');
assert(page.includes('Active Alerts') && page.includes('>18<'), 'KPI alerts 18');
assert(page.includes('Vehicles') && page.includes('>186<'), 'KPI vehicles 186');
assert(page.includes('Persons') && page.includes('>42<'), 'KPI persons 42');
assert(page.includes('Other Entities') && page.includes('>20<'), 'KPI others 20');

/* filters */
assert(page.includes('All Watchlists') && page.includes('All Types'), 'filter selects');
assert(page.includes('Search by Number / Name / Alias...'), 'search box');

/* three columns */
assert(page.includes('Watchlist Categories'), 'categories table');
assert(page.includes('High Priority Vehicles') && page.includes('VIP / Sensitive'), 'category rows');
assert(page.includes('Recent Watchlist Entries'), 'entries panel');
assert(page.includes('Recent Alerts'), 'alerts rail');
assert(page.includes('Watchlist Summary'), 'summary donut');

/* entries + plates */
assert(page.includes('GJ01AB1234') && page.includes('GJ05JK6789') && page.includes('GJ18CD4521'), 'required plates');
assert(page.includes('Arjun Rathod') && page.includes('Vikram Solanki'), 'person entries');

/* bottom row */
assert(page.includes('Alerts by Watchlist'), 'bar chart');
assert(page.includes('Matches Over Time'), 'line chart');
assert(page.includes('Top Matched Locations'), 'locations list');

/* drawer */
assert(drawer.includes('Identity') && drawer.includes('Match History'), 'drawer sections');
assert(drawer.includes('Latest Match') && drawer.includes('Matching Cameras'), 'drawer match info');
/* react-dom/server splits adjacent text nodes with comment markers */
assert(/97(<!-- -->)?% confidence/.test(drawer), 'drawer confidence');

/* modal */
assert(modal.includes('Reference Photo') && modal.includes('Operational Notes'), 'modal form fields');
assert(modal.includes('Plate Number'), 'modal vehicle label');

console.log(failed === 0 ? 'SSR SMOKE PASS' : `SSR SMOKE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
