/* Dev-only runtime smoke check for the Investigation screen (page + evidence
   viewer + case form) through react-dom/server so every component's render path
   runs. Also re-renders the pre-existing screens to prove the shared shell
   (Sidebar / TopHeader / mockData nav) still works.
   Usage: npx vite build --ssr scripts/investigation-smoke.tsx --outDir dist-ssr --emptyOutDir && node dist-ssr/investigation-smoke.js */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { CreateCaseModal } from '@/components/investigation/CreateCaseModal';
import { EvidenceViewerModal } from '@/components/investigation/EvidenceViewerModal';
import {
  buildEvidence,
  computeRouteAnalysis,
  defaultTargetPlate,
  investigationDossiers,
} from '@/data/investigationData';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { Investigation } from '@/pages/Investigation';
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

const dossier = investigationDossiers[defaultTargetPlate];
const sorted = [...dossier.sightings].sort((a, b) => a.seconds - b.seconds);
const last = sorted[sorted.length - 1];
const analysis = computeRouteAnalysis(sorted);
const evidence = buildEvidence(sorted);

const page = renderToString(
  <MemoryRouter>
    <Investigation />
  </MemoryRouter>,
);

const viewer = renderToString(
  <MemoryRouter>
    <EvidenceViewerModal
      sighting={last}
      plate={dossier.target.plate}
      index={sorted.length}
      total={sorted.length}
      onClose={() => undefined}
      onStep={() => undefined}
      onViewCamera={() => undefined}
      onExportFrame={() => undefined}
    />
  </MemoryRouter>,
);

const caseForm = renderToString(
  <MemoryRouter>
    <CreateCaseModal
      open
      dossier={dossier}
      evidence={evidence}
      suggestedRef="CR-118/2026"
      onClose={() => undefined}
      onCreate={() => undefined}
    />
  </MemoryRouter>,
);

/* react-dom/server splits adjacent text nodes with comment markers */
const flat = (html: string) => html.replace(/<!-- -->/g, '');

/* ---------------- page chrome + top controls ---------------- */
assert(page.includes('Investigation'), 'header title');
assert(
  page.includes('Trace vehicles, analyze cross-camera movements and investigate detected events'),
  'header subtitle',
);
assert(page.includes('New Investigation'), 'New Investigation control');
assert(page.includes('Search Vehicle / Plate'), 'search vehicle / plate control');
assert(page.includes('Export Case') && page.includes('Refresh'), 'export case + refresh');
assert(page.includes('All Locations') && page.includes('All Cameras'), 'location + camera filters');
assert(page.includes('value="2026-09-01"'), 'date filter prefilled');
assert(page.includes('INV-2026-0914'), 'investigation id chip');

/* ---------------- 1. target vehicle card ---------------- */
assert(page.includes('Target Vehicle'), 'target vehicle panel');
assert(page.includes('GJ01AB1234'), 'target plate');
assert(page.includes('White Swift Dzire'), 'target model label');
assert(page.includes('White'), 'target colour');
assert(flat(page).includes('Maruti Swift Dzire VXi (AMT)'), 'make / model / variant line');
assert(page.includes('Arjun Rathod'), 'registered owner');
assert(page.includes('Watchlist Match'), 'watchlist match status');
assert(page.includes('98.7%'), 'peak ANPR confidence');
assert(page.includes('First seen') && page.includes('10:21:15 AM'), 'first seen 10:21:15 AM');
assert(page.includes('Last seen') && page.includes('10:44:03 AM'), 'last seen 10:44:03 AM');
assert(page.includes('Total sightings') && page.includes(`>${dossier.sightings.length}<`), 'total sightings');
assert(page.includes('Current location'), 'current location tile');
assert(page.includes('High Priority Vehicles'), 'watchlist category');
assert(page.includes('WL-001'), 'watchlist entry id');

/* ---------------- 1b. investigation details rail ---------------- */
assert(page.includes('Investigation Details'), 'details panel');
assert(page.includes('Target state') && page.includes('Target status'), 'target state section');
assert(page.includes('Case &amp; movement'), 'case + movement section');
assert(page.includes('Assigned unit') && page.includes(dossier.unit), 'assigned unit');
assert(page.includes('Investigating officer') && page.includes(dossier.openedBy), 'investigating officer');
assert(page.includes('Case reference') && page.includes('Not filed yet'), 'case reference row');
assert(page.includes('Corridor') && page.includes(analysis.corridorLabel), 'movement corridor');
assert(page.includes('Direction') && page.includes(analysis.compass), 'movement direction row');
assert(page.includes('Escalate to control room'), 'escalate action');

/* ---------------- 2. cross-camera journey ---------------- */
assert(page.includes('Cross-Camera Vehicle Journey'), 'journey panel');
assert(page.includes('Shahibaug Road') && page.includes('Naranpura Road'), 'journey legs 1-2');
assert(page.includes('Kudasan Road') && page.includes('Gift City Road'), 'journey legs 3-4');
assert(page.includes('C-001') && page.includes('C-007') && page.includes('C-015') && page.includes('C-038'), 'journey cameras');
assert(page.includes('Route reconstruction · GIS'), 'journey mini map');
assert(page.includes('Replay route'), 'route replay control');
assert(page.includes('Live tracking'), 'live tracking control');
assert(page.includes('View C-'), 'view camera control for the active node');
assert(page.includes('route nodes'), 'route node count');
assert(page.includes('longest gap'), 'longest gap readout in the journey footer');

/* ---------------- 3. sighting history ---------------- */
assert(page.includes('Sighting History'), 'sighting history panel');
assert(
  page.includes('Camera ID') &&
    page.includes('Location') &&
    page.includes('Timestamp') &&
    page.includes('ANPR / plate confidence') &&
    page.includes('Vehicle type') &&
    page.includes('Direction') &&
    page.includes('Evidence / status'),
  'sighting table columns',
);
assert(page.includes('Route nodes only') && page.includes('Any confidence'), 'sighting filters');
assert(page.includes('Include re-reads'), 're-read filter');
assert(page.includes('View evidence'), 'evidence control in table');
assert(flat(page).includes(`${dossier.sightings.length} of ${dossier.sightings.length} readings`), 'sighting count readout');

/* ---------------- 4. related events ---------------- */
assert(page.includes('Related Events'), 'related events panel');
assert(page.includes('Watchlist Match') && page.includes('Speed Violation'), 'watchlist + speed events');
assert(page.includes('Wrong Direction') && page.includes('Red Light Violation'), 'wrong direction + red light events');
assert(page.includes('ALRT-2461') && page.includes('ALRT-2458'), 'linked alert ids');

/* ---------------- 4b. route analysis ---------------- */
assert(page.includes('Route Analysis'), 'route analysis panel');
assert(page.includes(analysis.durationLabel), `journey duration ${analysis.durationLabel}`);
assert(page.includes('Cameras crossed') && page.includes(`>${analysis.camerasCrossed}<`), 'cameras crossed');
assert(page.includes(`${analysis.distanceKm.toFixed(1)} km`), 'distance estimate');
assert(page.includes('Avg time between cams') && page.includes(analysis.avgGapLabel), 'average time between cameras');
assert(page.includes('Movement direction') && page.includes(analysis.compass), 'movement direction');

/* ---------------- 4c. related vehicles ---------------- */
assert(page.includes('Related Vehicles'), 'associations panel');
assert(page.includes('GJ27RS3391') && page.includes('GJ05JK6789') && page.includes('GJ18CD4521'), 'related vehicles');
assert(page.includes('Registered owner'), 'person association');
assert(page.includes('shared gantries'), 'co-detection score');
assert(
  flat(page).includes('7/10 shared gantries'),
  'derived co-detection score (GJ27RS3391 shares 7 of 10 gantries)',
);

/* ---------------- reading order (required hierarchy) ---------------- */
const order = [
  'Target Vehicle',
  'Investigation Details',
  'Cross-Camera Vehicle Journey',
  'Sighting History',
  'Related Events',
  'Route Analysis',
  'Related Vehicles',
].map((title) => page.indexOf(`>${title}<`));
assert(order.every((index) => index > -1), 'every hierarchy panel rendered');
assert(
  order.every((index, i) => i === 0 || index > order[i - 1]),
  `hierarchy order target → details → journey → history → events/analysis/vehicles (${order.join(' < ')})`,
);

/* ---------------- removed low-value UI stays removed ---------------- */
assert(!page.includes('Evidence Gallery'), 'evidence gallery removed (duplicated by the sighting table)');
assert(!page.includes('Sightings Over Time'), 'sightings-over-time chart removed');
assert(!page.includes('Camera Frequency'), 'camera-frequency chart removed');
assert(!page.includes('Location Distribution'), 'location-distribution chart removed');
assert(!page.includes('Investigation Search'), 'duplicate search band removed');
assert(!page.includes('Matching cameras'), 'matching-camera chip wall removed from the details rail');

/* ---------------- action bar ---------------- */
assert(page.includes('Track Live'), 'track live action');
assert(page.includes('View Camera'), 'view camera action');
assert(page.includes('Add to Watchlist'), 'add to watchlist action');
assert(page.includes('Create Case'), 'create case action');
assert(page.includes('Export Evidence'), 'export evidence action');
assert(page.includes('Close Investigation'), 'close investigation action');

/* ---------------- evidence viewer ---------------- */
assert(viewer.includes('Evidence') && viewer.includes('C-038'), 'evidence viewer identity');
assert(viewer.includes('route node 4') && viewer.includes('watchlist match'), 'evidence viewer chips');
assert(viewer.includes('Plate OCR confidence') && viewer.includes('Clip reference'), 'evidence telemetry');
assert(viewer.includes('Fullscreen') && viewer.includes('View camera'), 'evidence viewer actions');
assert(viewer.includes('Prev sighting') && viewer.includes('Next sighting'), 'evidence navigation');
assert(viewer.includes('98.7%'), 'evidence confidence');

/* ---------------- case form ---------------- */
assert(caseForm.includes('Create Case'), 'case form title');
assert(caseForm.includes('Case title') && caseForm.includes('Priority'), 'case title + priority fields');
assert(caseForm.includes('Investigation notes'), 'notes field');
assert(caseForm.includes('Selected evidence'), 'selected evidence field');
assert(caseForm.includes('Offence / classification') && caseForm.includes('FIR / NC number'), 'offence + FIR fields');
assert(caseForm.includes('CR-118/2026'), 'suggested case reference');
assert(
  flat(caseForm).includes(
    `${evidence.filter((item) => item.primary || item.watchlistHit).length} of ${evidence.length} frames`,
  ),
  'evidence selection count',
);

/* ---------------- no regression on the existing screens ---------------- */
const watchlist = renderToString(
  <MemoryRouter>
    <Watchlist />
  </MemoryRouter>,
);
const alerts = renderToString(
  <MemoryRouter>
    <Alerts />
  </MemoryRouter>,
);
const analyticsPage = renderToString(
  <MemoryRouter>
    <Analytics />
  </MemoryRouter>,
);

assert(watchlist.includes('Watchlist Management') && watchlist.includes('GJ01AB1234'), 'watchlist screen intact');
assert(alerts.includes('Alert Management') && alerts.includes('Alerts Over Time'), 'alerts screen intact');
assert(analyticsPage.includes('AI Analytics') && analyticsPage.includes('Vehicle Detection Trend'), 'analytics screen intact');

console.log(failed === 0 ? 'INVESTIGATION SMOKE PASS' : `INVESTIGATION SMOKE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
