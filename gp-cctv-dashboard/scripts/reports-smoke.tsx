/* Dev-only runtime smoke check for the REPORTS — INTELLIGENCE REPORTS &
   ANALYTICS workspace: renders the page plus the configuration modal and the
   full report viewer through react-dom/server and asserts the brief's exact
   content, then re-renders the eight pre-existing screens to prove the shared
   shell and the other workspaces are untouched.
   Usage: npx vite build --ssr scripts/reports-smoke.tsx --outDir node_modules/.ssr-reports --emptyOutDir \
          && node node_modules/.ssr-reports/reports-smoke.js */
import type { ReactElement } from 'react';

import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import App from '@/App';
import { GenerateReportModal } from '@/components/reports/GenerateReportModal';
import { ReportViewerModal } from '@/components/reports/ReportViewerModal';
import {
  defaultReportFilters,
  recentReports,
  reportDistribution,
  reportKpis,
  reportsByType,
  reportsRegistryCsv,
  reportsTrend,
  sampleReportPreview,
  scheduledReports,
  topReportedLocations,
} from '@/data/reportsData';
import { Alerts } from '@/pages/Alerts';
import { Analytics } from '@/pages/Analytics';
import { CameraHealth } from '@/pages/CameraHealth';
import { CameraMap } from '@/pages/CameraMap';
import { Dashboard } from '@/pages/Dashboard';
import { Investigation } from '@/pages/Investigation';
import { LiveView } from '@/pages/LiveView';
import { Reports } from '@/pages/Reports';
import { Users } from '@/pages/Users';
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

/* ---------------- page render ---------------- */

const page = flat(
  renderToString(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  ),
);

assert(page.includes('Reports'), 'page title renders REPORTS');
assert(page.includes('Generate, review and export CCTV intelligence reports'), 'subtitle matches the brief');
assert(page.includes('intelligence reports &amp; analytics'), 'INTELLIGENCE REPORTS & ANALYTICS workspace badge renders');

/* header actions */
['Generate Report', 'Schedule Report', 'Export', 'Refresh'].forEach((action) =>
  assert(page.includes(action), `header action "${action}" present`),
);

/* KPI strip — the exact numbers from the brief */
assert(page.includes('Reports Generated') && page.includes(String(reportKpis.generated)), 'KPI Reports Generated 128');
assert(page.includes('Pending Reports') && page.includes(String(reportKpis.pending)), 'KPI Pending Reports 6');
assert(page.includes('Investigation Reports') && page.includes(String(reportKpis.investigation)), 'KPI Investigation Reports 42');
assert(page.includes('Alert Reports') && page.includes(String(reportKpis.alert)), 'KPI Alert Reports 57');
assert(page.includes('Scheduled Reports') && page.includes(String(reportKpis.scheduled)), 'KPI Scheduled Reports 23');

/* report builder */
assert(page.includes('Generate New Report'), 'report-generation panel renders');
['Vehicle Intel', 'Watchlist', 'Alerts', 'Cam Health', 'Traffic', 'Journey', 'Daily Ops'].forEach((type) =>
  assert(page.includes(type), `report type option "${type}" present`),
);
['Date Range', 'Location', 'Camera', 'Department', 'Severity'].forEach((filter) =>
  assert(page.includes(filter), `builder filter "${filter}" present`),
);
assert(page.includes('Last 24 Hours') && page.includes('All Gujarat'), 'default filter values render');

/* recent reports table */
assert(page.includes('Recent Reports'), 'RECENT REPORTS table renders');
['Report ID', 'Report Name', 'Type', 'Generated', 'Created By', 'Status', 'Size', 'Actions'].forEach((column) =>
  assert(page.includes(column), `registry column "${column}" present`),
);
recentReports.slice(0, 6).forEach((row) => assert(page.includes(row.id), `registry row ${row.id} renders`));
assert(page.includes('Rajveer Chauhan') && page.includes('Kavita Sharma'), 'officer names render');
assert(page.includes('Completed') && page.includes('Pending') && page.includes('Generating') && page.includes('Failed'), 'all four status states render');
assert(page.includes('4.8 MB') && page.includes('11.2 MB'), 'document sizes render');

/* report preview */
assert(page.includes('Report Preview'), 'REPORT PREVIEW panel renders');
assert(page.includes('GJ01AB1234'), 'selected vehicle GJ01AB1234 renders');
assert(page.includes('Vehicle Intelligence Report'), 'sample document title renders');
assert(page.includes('Camera Journey') && page.includes('Route Reconstruction'), 'journey + map route sections render');
assert(page.includes('Alert Summary') && page.includes('Key Statistics'), 'alert summary + statistics sections render');
assert(page.includes('Evidence Frames') && page.includes('Findings'), 'evidence + findings sections render');
sampleReportPreview.journey.forEach((leg) => assert(page.includes(leg.cameraCode), `journey leg ${leg.cameraCode} renders`));
assert(page.includes('Shahibaug Road') && page.includes('Gift City Road'), 'Gujarat journey roads render');

/* report analytics */
assert(page.includes('Report Analytics'), 'REPORT ANALYTICS section renders');
assert(page.includes('Reports by Type'), 'Reports by Type bar chart renders');
assert(page.includes('Reports Generated Over Time'), 'Reports Generated Over Time chart renders');
assert(page.includes('Report Distribution'), 'Alert/Vehicle/Watchlist distribution renders');
assert(page.includes('Top Reported Locations'), 'Top Reported Locations renders');
reportDistribution.forEach((slice) => assert(page.includes(slice.label), `distribution slice "${slice.label}" renders`));
topReportedLocations.slice(0, 4).forEach((location) =>
  assert(page.includes(location.location), `top location "${location.location}" renders`),
);
assert(reportsByType.reduce((acc, slice) => acc + slice.count, 0) === reportKpis.generated, 'reports-by-type counts sum to the generated KPI (128)');
assert(reportsTrend.length === 14, 'trend series covers 14 days');

/* scheduled reports */
assert(page.includes('Scheduled Reports'), 'SCHEDULED REPORTS panel renders');
['Report Name', 'Frequency', 'Next Run', 'Recipient / Role', 'Active'].forEach((column) =>
  assert(page.includes(column), `schedule column "${column}" present`),
);
scheduledReports.slice(0, 4).forEach((schedule) => assert(page.includes(schedule.name), `schedule "${schedule.name}" renders`));
assert(page.includes('Daily · 06:00 IST') && page.includes('DGP Office'), 'cadence + recipient render');

/* CSV seam */
const csv = reportsRegistryCsv(recentReports);
assert(csv.startsWith('Report ID,Report Name,Type'), 'registry CSV has the expected header');
assert(csv.split('\n').length === recentReports.length + 1, 'registry CSV has one line per report');

/* ---------------- configuration modal ---------------- */

const modal = flat(
  renderToString(
    <GenerateReportModal open mode="now" seed={defaultReportFilters} onClose={() => {}} onSubmit={() => {}} />,
  ),
);
assert(modal.includes('Configure Intelligence Report'), 'Generate Report opens the detailed configuration modal');
assert(modal.includes('Generate Now') && modal.includes('Recurring Schedule'), 'modal offers now + schedule modes');
assert(modal.includes('Included Sections') && modal.includes('Output Format') && modal.includes('Classification'), 'modal renders sections / format / classification controls');
assert(modal.includes('PDF') && modal.includes('CSV') && modal.includes('XLSX'), 'output formats render');

const scheduleModal = flat(
  renderToString(
    <GenerateReportModal open mode="schedule" seed={defaultReportFilters} onClose={() => {}} onSubmit={() => {}} />,
  ),
);
assert(scheduleModal.includes('Schedule Recurring Report'), 'Schedule Report opens the modal in schedule mode');
assert(scheduleModal.includes('Run At (IST)'), 'schedule mode exposes cadence controls');

/* ---------------- full report viewer ---------------- */

const viewer = flat(
  renderToString(
    <ReportViewerModal
      open
      report={recentReports[0]}
      doc={sampleReportPreview}
      onClose={() => {}}
      onDownload={() => {}}
      onShare={() => {}}
    />,
  ),
);
assert(viewer.includes(recentReports[0].name), 'viewer shows the selected report');
assert(viewer.includes('Download PDF') && viewer.includes('Share'), 'viewer download/share affordances render');
assert(viewer.includes('Evidence Appendix') && viewer.includes('Findings &amp; Recommendations'), 'viewer renders the full document sections');
assert(viewer.includes('Chain of custody sealed'), 'viewer footer renders');

/* ---------------- pre-existing screens still render ---------------- */

const renders = (element: ReactElement, name: string) => {
  try {
    const html = renderToString(<MemoryRouter>{element}</MemoryRouter>);
    assert(html.length > 5000, `${name} still renders (${html.length} chars)`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name} threw: ${(error as Error).message}`);
  }
};

renders(<Dashboard />, 'Dashboard');
renders(<LiveView />, 'Live View');
renders(<CameraMap />, 'Camera Map');
renders(<Watchlist />, 'Watchlist');
renders(<Alerts />, 'Alerts');
renders(<Analytics />, 'Analytics');
renders(<Investigation />, 'Investigation');
renders(<CameraHealth />, 'Camera Health');
renders(<Users />, 'Users & Roles');
renders(<App />, 'App shell');

const appHtml = flat(renderToString(<MemoryRouter initialEntries={['/reports']}><App /></MemoryRouter>));
assert(appHtml.includes('Generate, review and export CCTV intelligence reports'), 'App routes /reports to the Reports workspace');
assert(appHtml.includes('Gujarat Police') && appHtml.includes('Unified AI CCTV Intelligence Platform'), 'sidebar identity block untouched');

console.log(failed === 0 ? '\nALL REPORTS SMOKE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
