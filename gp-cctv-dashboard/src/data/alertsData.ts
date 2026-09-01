import {
  Activity,
  AlertTriangle,
  Ban,
  BellRing,
  Bike,
  Camera,
  Car,
  CircleSlash,
  Flame,
  Gauge,
  Navigation,
  Package,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Star,
  Truck,
  UserSearch,
  UsersRound,
} from 'lucide-react';

import camC001 from '@/assets/cam-c001.jpg';
import camC007 from '@/assets/cam-c007.jpg';
import camC015 from '@/assets/cam-c015.jpg';
import camC038 from '@/assets/cam-c038.jpg';
import camC045 from '@/assets/cam-c045.jpg';
import camC052 from '@/assets/cam-c052.jpg';
import camC089 from '@/assets/cam-c089.jpg';
import camC115 from '@/assets/cam-c115.jpg';
import camC131 from '@/assets/cam-c131.jpg';
import camC160 from '@/assets/cam-c160.jpg';
import camC207 from '@/assets/cam-c207.jpg';
import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';

import type {
  AlertGroupId,
  AlertJourneyStop,
  AlertResponseEvent,
  AlertRecord,
  AlertTimePoint,
  TopAlertLocation,
} from '@/types/alerts';

/* ------------------------------------------------------------------ *
 * Reference clock. The console narrative "now" is 10:46:03 AM, 01 Sep 2026,
 * so ALRT-2461 (2 min ago) lands exactly on the dashboard's 10:44:03 AM.
 * ------------------------------------------------------------------ */

const BASE = 10 * 3600 + 46 * 60 + 3;

function fmt(totalSeconds: number): string {
  const t = ((totalSeconds % 86400) + 86400) % 86400;
  const h24 = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** Wall-clock string for an event `minutesAgo` minutes before the reference clock. */
export function alertTime(minutesAgo: number): string {
  return fmt(BASE - minutesAgo * 60 - ((minutesAgo * 29) % 47));
}

/** Seconds offset for the simulated live streams (advances ~4 s per tick). */
export function alertStreamTime(tick: number): string {
  return fmt(BASE + tick * 4);
}

export function agoOf(minutes: number): string {
  if (minutes <= 0) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 600) return `${(minutes / 60).toFixed(1)} hr ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

/** Compact response-log builder: time derived from its own minutesAgo offset. */
function ev(
  id: string,
  minutesAgo: number,
  label: string,
  detail: string,
  actor: string,
  tone: AlertResponseEvent['tone'],
  pending = false,
): AlertResponseEvent {
  return {
    id,
    label,
    detail,
    actor,
    time: pending ? '—' : alertTime(minutesAgo),
    ago: pending ? 'awaiting' : agoOf(minutesAgo),
    tone,
    pending,
  };
}

/* ------------------------------------------------------------------ *
 * Alert type groups (filter select + bar chart share these)
 * ------------------------------------------------------------------ */

export const alertTypeGroups: Array<{ id: AlertGroupId; label: string; color: string }> = [
  { id: 'watchlist', label: 'Watchlist & ANPR', color: '#ef4444' },
  { id: 'speed', label: 'Speed Violation', color: '#f59e0b' },
  { id: 'wrongdir', label: 'Wrong Direction', color: '#a855f7' },
  { id: 'redlight', label: 'Red Light Violation', color: '#2f7dff' },
  { id: 'crowd', label: 'Crowd / Gathering', color: '#22d3ee' },
  { id: 'security', label: 'Security AI', color: '#eab308' },
  { id: 'traffic', label: 'Traffic Behaviour', color: '#34d399' },
  { id: 'patrol', label: 'Suspicious Activity', color: '#94a3b6' },
];

const CAMERAS: Record<string, { location: string; city: string; zone: string; thumb: string }> = {
  'C-001': { location: 'Shahibaug Road', city: 'Ahmedabad', zone: 'Zone I · Shahibaug', thumb: camC001 },
  'C-007': { location: 'Naranpura Road', city: 'Ahmedabad', zone: 'Zone II · Naranpura', thumb: camC007 },
  'C-015': { location: 'Kudasan Road', city: 'Gandhinagar', zone: 'Gandhinagar North', thumb: camC015 },
  'C-038': { location: 'Gift City Road', city: 'Gandhinagar', zone: 'Gandhinagar Sector 28', thumb: camC038 },
  'C-045': { location: 'Iskcon Circle', city: 'Ahmedabad', zone: 'Zone IV · Sarkhej', thumb: camC045 },
  'C-052': { location: 'Vastrapur Lake Road', city: 'Ahmedabad', zone: 'Zone III · Vastrapur', thumb: camC052 },
  'C-089': { location: 'Maninagar Junction', city: 'Ahmedabad', zone: 'Zone VI · Maninagar', thumb: camC089 },
  'C-115': { location: 'S.G. Highway', city: 'Ahmedabad', zone: 'Zone IV · Bodakdev', thumb: camC115 },
  'C-131': { location: 'Kalawad Road', city: 'Rajkot', zone: 'Rajkot West', thumb: camC131 },
  'C-160': { location: 'Ring Road', city: 'Surat', zone: 'Surat Central', thumb: camC160 },
  'C-207': { location: 'Vadodara City Center', city: 'Vadodara', zone: 'Raopura', thumb: camC207 },
};

const cam = (code: string) => CAMERAS[code];

type RawAlert = Omit<
  AlertRecord,
  'location' | 'city' | 'zone' | 'thumbnail' | 'time' | 'ago' | 'firstSeen' | 'lastSeen'
> & {
  time?: string;
  ago?: string;
};

function mk(raw: RawAlert): AlertRecord {
  const meta = cam(raw.camera);
  const first = raw.journey[0];
  return {
    ...raw,
    location: meta.location,
    city: meta.city,
    zone: meta.zone,
    thumbnail: meta.thumb,
    time: raw.time ?? alertTime(raw.minutesAgo),
    ago: raw.ago ?? agoOf(raw.minutesAgo),
    firstSeen: first ? `${first.time} · ${first.camera}` : raw.minutesAgo > 3 ? `${raw.time} · ${raw.camera}` : raw.time,
    lastSeen: `${raw.time} · ${raw.camera}`,
  };
}

const stop = (
  step: number,
  minutesAgo: number,
  code: string,
  speedKph: number,
  heading: string,
  alert = false,
): AlertJourneyStop => {
  const meta = cam(code);
  return {
    step,
    time: alertTime(minutesAgo),
    camera: code,
    road: meta.location,
    city: meta.city,
    thumbnail: meta.thumb,
    speedKph,
    heading,
    alert,
  };
};

/* ------------------------------------------------------------------ *
 * Alerts — 23 events for the morning shift of 01 Sep 2026.
 * 4 critical · 7 high · 8 medium · 4 info · 4 resolved · 12 unreviewed.
 * The first four intentionally mirror the Dashboard "Recent Alerts" rail.
 * ------------------------------------------------------------------ */

export const alerts: AlertRecord[] = [
  mk({
    id: 'ALRT-2461',
    title: 'Watchlist Match',
    subject: 'GJ01AB1234',
    plate: 'GJ01AB1234',
    objectLabel: 'White Maruti Swift Dzire · 2019',
    groupId: 'watchlist',
    severity: 'critical',
    status: 'new',
    camera: 'C-038',
    confidence: 98.7,
    minutesAgo: 2,
    time: '10:44:03 AM',
    ago: '2 min ago',
    watchlistList: 'High Priority Vehicles',
    caseRef: 'CR-114/2026 · Ahmedabad Rural',
    assignedTo: 'Insp. Rajveer',
    details: 'ANPR hit on High Priority Vehicles list — armed robbery case CR-114/2026. Vehicle flagged for immediate verification; occupants unknown.',
    notes: 'Same plate last seen 28 Aug near Bopal. BOLO drafted, awaiting supervisor sign-off before dispatch.',
    evidence: [vehicleSnapshot, camC015, camC007],
    icon: ShieldAlert,
    relatedCameras: ['C-001', 'C-007', 'C-015'],
    journey: [
      stop(1, 25, 'C-001', 58, 'NE'),
      stop(2, 18, 'C-007', 66, 'NW'),
      stop(3, 12, 'C-015', 79, 'NE'),
      stop(4, 2, 'C-038', 71, 'SW', true),
    ],
    timeline: [
      ev('t1', 2, 'AI detection · ANPR match', 'Frame C-038 matched High Priority list @ 98.7%', 'Edge Node G-04', 'red'),
      ev('t2', 1, 'Evidence archived', '2 snapshots + 40 s clip pinned to case CR-114/2026', 'Auto-archive', 'cyan'),
      ev('t3', 1, 'Pushed to control room', 'Priority tone sent to Watch-2, PCR van 07 notified', 'Alert Engine', 'orange'),
      ev('t4', 0, 'Operator acknowledgement', 'SLA 02:00 — no response yet', 'Insp. Rajveer', 'blue', true),
      ev('t5', 0, 'Field verification unit', 'Awaiting dispatch clearance from supervisor', 'DCB Ahmedabad', 'purple', true),
    ],
  }),
  mk({
    id: 'ALRT-2460',
    title: 'Speed Violation',
    subject: 'GJ05JK6789',
    plate: 'GJ05JK6789',
    objectLabel: 'Black Hyundai Verna · 2021',
    groupId: 'speed',
    severity: 'high',
    status: 'acknowledged',
    camera: 'C-115',
    confidence: 96.1,
    minutesAgo: 4,
    time: '10:42:11 AM',
    ago: '4 min ago',
    speedKph: 132,
    limitKph: 70,
    heading: 'NE → SW · lane 2',
    caseRef: 'TC-99051/2026',
    assignedTo: 'PSI Mahesan',
    details: 'Radar-verified 132 km/h in a 70 zone near Bodakdev flyover; radar–camera offset ±2 km/h. Repeat offender (2 priors this year).',
    notes: 'E-challan drafted under MVI 183(b). Intercept team suggested at Prahladnagar signal.',
    evidence: [camC115, camC045],
    icon: Gauge,
    relatedCameras: ['C-045', 'C-052', 'C-038'],
    journey: [stop(1, 22, 'C-045', 74, 'N'), stop(2, 4, 'C-115', 132, 'NE → SW', true)],
    timeline: [
      ev('t1', 4, 'Speed sample captured', '132 km/h over 3 consecutive frames · radar lock', 'ANPR/Radar C-115', 'orange'),
      ev('t2', 3, 'Owner fetched', 'Rideshare fleet vehicle · Nagina Transport, Sananda', 'Vehicle Registry', 'blue'),
      ev('t3', 2, 'Acknowledged', 'Reviewed by shift supervisor, challan drafted', 'PSI Mahesan', 'cyan'),
      ev('t4', 0, 'Field intercept', 'Suggested at Prahladnagar — awaiting unit availability', 'PCR Van 12', 'purple', true),
    ],
  }),
  mk({
    id: 'ALRT-2459',
    title: 'Wrong Direction',
    subject: 'GJ18CD4521',
    plate: 'GJ18CD4521',
    objectLabel: 'Silver Tata Nexon · 2023',
    groupId: 'wrongdir',
    severity: 'medium',
    status: 'new',
    camera: 'C-207',
    confidence: 93.4,
    minutesAgo: 7,
    time: '10:38:55 AM',
    ago: '7 min ago',
    heading: 'Against flow · flydown ramp',
    assignedTo: 'Unassigned',
    details: 'Travelling against flow on the MC Circle flydown; two near-miss events with two-wheelers detected by AI collision model.',
    notes: 'Likely navigation error — exit taken at Old Padrau Road. No prior flags on plate.',
    evidence: [camC207, camC207],
    icon: AlertTriangle,
    relatedCameras: ['C-207', 'C-160'],
    journey: [],
    timeline: [
      ev('t1', 7, 'AI detection', 'Wrong-way heading locked for 11 s · near-miss count 2', 'Behavior Model v2.3', 'yellow'),
      ev('t2', 6, 'Snapshot archived', 'Best frame + heading vector attached to incident', 'Auto-archive', 'cyan'),
      ev('t3', 0, 'Operator acknowledgement', 'Queued for review · Watch-1', 'Raopura Control', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2458',
    title: 'Crowd Detected',
    subject: 'Crowd · ~140 persons',
    groupId: 'crowd',
    severity: 'info',
    status: 'acknowledged',
    camera: 'C-089',
    confidence: 88.2,
    minutesAgo: 10,
    time: '10:35:20 AM',
    ago: '10 min ago',
    assignedTo: 'PSI K. Chauhan',
    details: 'Foot-overbridge queue surged past density threshold 3.4 pax/m² after signal failure; trend stable for 6 min, no aggro behaviour.',
    notes: 'Signal technician notified by Traffic Control. Re-check density at 11:00.',
    evidence: [camC089, camC052],
    icon: UsersRound,
    relatedCameras: ['C-052', 'C-007'],
    journey: [],
    timeline: [
      ev('t1', 10, 'Crowd density alert', 'Threshold 3.0 → peak 3.4 pax/m² · count ~140', 'Crowd Model', 'blue'),
      ev('t2', 8, 'Cause correlated', 'Signal controller fault logged by Traffic Control', 'Traffic Control', 'cyan'),
      ev('t3', 6, 'Acknowledged', 'Watch-1 monitoring; no police request raised', 'PSI K. Chauhan', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2457',
    title: 'Stolen Vehicle Alert',
    subject: 'GJ07HJ5566',
    plate: 'GJ07HJ5566',
    objectLabel: 'Red Mahindra Scorpio · 2018',
    groupId: 'watchlist',
    severity: 'critical',
    status: 'new',
    camera: 'C-015',
    confidence: 97.2,
    minutesAgo: 14,
    watchlistList: 'Stolen Vehicles',
    caseRef: 'ST-88/2026 · Bopal PS',
    assignedTo: 'Unassigned',
    details: 'Scorpio reported stolen 24 Aug from Bopal; plate + grille geometry double-confirmed. Possible number-plate swap in transit.',
    notes: 'Do not attempt independent stop — coordinate with DCB chase team before intercept.',
    evidence: [camC015, camC045],
    icon: Car,
    relatedCameras: ['C-045', 'C-038', 'C-001'],
    journey: [stop(1, 44, 'C-045', 68, 'S'), stop(2, 14, 'C-015', 74, 'NW', true)],
    timeline: [
      ev('t1', 14, 'ANPR match — stolen list', 'ST-88/2026 Bopal PS · geometry score 97.2%', 'Edge Node G-02', 'red'),
      ev('t2', 13, 'Prior sighting linked', 'Same plate on Ring Road camera 29 Aug 21:40', 'Investigation Graph', 'purple'),
      ev('t3', 12, 'Pushed to control room', 'Bolo tone to all Sector-11 units', 'Alert Engine', 'orange'),
      ev('t4', 0, 'Intercept authorisation', 'Awaiting DCB supervisor confirmation', 'DCB Ahmedabad', 'red', true),
    ],
  }),
  mk({
    id: 'ALRT-2456',
    title: 'Red Light Violation',
    subject: 'GJ01KL4477',
    plate: 'GJ01KL4477',
    objectLabel: 'Grey Maruti Baleno · 2022',
    groupId: 'redlight',
    severity: 'high',
    status: 'new',
    camera: 'C-001',
    confidence: 95.8,
    minutesAgo: 18,
    heading: 'S → N · stopline +1.9 s',
    details: 'Crossed stopline 1.9 s after signal turned red; pedestrian phase active with 4 users in crosswalk.',
    notes: 'Crosswalk exposure flagged for TATW citation in addition to red-light challan.',
    evidence: [camC001, camC001],
    icon: CircleSlash,
    relatedCameras: ['C-052', 'C-007'],
    journey: [],
    timeline: [
      ev('t1', 18, 'Signal-phase violation', 'Red-light crossing · pedestrian phase overlap', 'Signal Cam C-001', 'orange'),
      ev('t2', 17, 'Clip archived', '6 s violation clip + crosswalk overlay saved', 'Auto-archive', 'cyan'),
      ev('t3', 0, 'Operator acknowledgement', 'Unreviewed', 'Watch-1', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2455',
    title: 'Unattended Object',
    subject: 'Black duffel bag',
    groupId: 'security',
    severity: 'critical',
    status: 'investigating',
    camera: 'C-052',
    confidence: 90.6,
    minutesAgo: 21,
    assignedTo: 'Insp. Sarita Yadav',
    details: 'Duffel bag left at bus shelter #14 (lake gate side) and unmoved for 9+ min while crowd density stayed high. Cordon requested.',
    notes: 'Pedestrian flow diverted across service road. EOD team on standby — not yet dispatched.',
    evidence: [camC052, camC001],
    icon: Package,
    relatedCameras: ['C-001', 'C-089'],
    journey: [],
    timeline: [
      ev('t1', 21, 'Object abandonment detected', 'Dropped 10:23 · static 9 m 14 s · zone: shelter #14', 'Object Model v1.8', 'red'),
      ev('t2', 19, 'Cordon initiated', 'Footpath closed both directions, 40 m radius', 'PCR Van 05', 'orange'),
      ev('t3', 16, 'Owner inquiry', 'Shelter occupants interviewed — no claim', 'CPC Rajpur', 'purple'),
      ev('t4', 12, 'Escalated internally', 'EOD request raised, response ETA 8–10 min', 'Control Room 100', 'red'),
      ev('t5', 0, 'Scene clearance', 'Pending EOD sweep report', 'HQ EOD-2', 'green', true),
    ],
  }),
  mk({
    id: 'ALRT-2454',
    title: 'Triple-Ride / No Helmet',
    subject: 'GJ03BM8890',
    plate: 'GJ03BM8890',
    objectLabel: 'Red Honda SP 125 · 2020',
    groupId: 'traffic',
    severity: 'medium',
    status: 'acknowledged',
    camera: 'C-045',
    confidence: 92.1,
    minutesAgo: 26,
    heading: 'N → S · bus-lane edge',
    assignedTo: 'PSI Mahesan',
    details: 'Three riders, zero helmets, lane-splitting through Iskcon Circle queue. Violation clip rendered for e-challan review.',
    notes: 'Riders appear to be college commuters; cite and release — no pursuit warranted.',
    evidence: [camC045, camC115],
    icon: Bike,
    relatedCameras: ['C-115', 'C-007'],
    journey: [],
    timeline: [
      ev('t1', 26, 'Ppe/count violation', '3 riders + 3× no-helmet · frame confidence 92.1%', 'Two-Wheeler Model', 'yellow'),
      ev('t2', 24, 'E-challan drafted', 'Sections 129A / 177 queued for approval', 'Traffic Branch', 'blue'),
      ev('t3', 20, 'Acknowledged', 'Reviewed at terminal 3', 'PSI Mahesan', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2453',
    title: 'Wanted Person Match',
    subject: 'Mukesh Chauhan',
    objectLabel: 'Male · 29 yrs · red t-shirt · cap',
    groupId: 'watchlist',
    severity: 'high',
    status: 'new',
    camera: 'C-089',
    confidence: 87.4,
    minutesAgo: 29,
    watchlistList: 'Wanted Persons',
    caseRef: 'AC-41/2026 · Maninagar PS',
    assignedTo: 'Unassigned',
    details: 'Face-model match against wanted list (festival pickpocket network). Score below auto-flag threshold — needs human verification before BOLO.',
    notes: 'Alias “Muku”. Two companions of interest at ~1.5× frame scale; verify gait before acting.',
    evidence: [camC089, camC052],
    icon: UserSearch,
    relatedCameras: ['C-052', 'C-007', 'C-001'],
    journey: [],
    timeline: [
      ev('t1', 29, 'Face match proposed', 'Top-1 score 87.4% vs AC-41/2026 subject photo', 'Face Model v0.9b', 'orange'),
      ev('t2', 28, 'Co-occupants logged', '2 unknown companions tracked southbound', 'Behavior Model', 'purple'),
      ev('t3', 0, 'Human verification', 'Required for scores < 90% — Watch-2', 'Face Review Desk', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2452',
    title: 'Overloaded + Speeding',
    subject: 'GJ06PQ2210',
    plate: 'GJ06PQ2210',
    objectLabel: 'Blue Ashok Leyland truck · 34 t',
    groupId: 'speed',
    severity: 'high',
    status: 'new',
    camera: 'C-131',
    confidence: 89.9,
    minutesAgo: 33,
    speedKph: 89,
    limitKph: 60,
    heading: 'W → E · SH-25 mainline',
    details: 'Estimated gross load ≈ 34 t on a 25 t permit; 89 km/h at Kalawad Road curve — brake-fade risk for the school zone ahead.',
    notes: ' weighbridge check requested at Rajkot East; escort advisory issued to pilot van.',
    evidence: [camC131, camC131],
    icon: Truck,
    relatedCameras: ['C-131', 'C-160'],
    journey: [],
    timeline: [
      ev('t1', 33, 'Axle-load estimate', 'Modelled 34 t gross · permit ceiling 25 t', 'Load Estimator', 'orange'),
      ev('t2', 32, 'Speed sample', '89 km/h in 60 zone · curve approach', 'Radar C-131', 'yellow'),
      ev('t3', 0, 'Weighbridge referral', 'Awaiting RTO Rajkot confirmation', 'RTO Cell', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2451',
    title: 'Fire / Smoke Detected',
    subject: 'Smoke plume · stall row',
    groupId: 'security',
    severity: 'critical',
    status: 'escalated',
    camera: 'C-160',
    confidence: 91.9,
    minutesAgo: 37,
    assignedTo: 'Insp. Sarita Yadav',
    details: 'Grey-to-black smoke column ~30 m above textile stall row under Ring Road underpass; wind pushing plume toward footpath.',
    notes: 'Fire tender 14 en route (ETA 4 min). Camera re-aimed to 2.4× on seat of fire.',
    evidence: [camC160, camC160],
    icon: Flame,
    relatedCameras: ['C-160', 'C-131'],
    journey: [],
    timeline: [
      ev('t1', 37, 'Smoke classifier fired', 'Plume 30 m · severity 4/5 · 91.9% confidence', 'Fire Model v1.2', 'red'),
      ev('t2', 36, 'Fire brigade notified', 'Tender 14 dispatched from Katargam', 'Control Room 101', 'orange'),
      ev('t3', 34, 'Footpath closed', 'Ranger team diverting pedestrians to upper deck', 'SRPF Surat', 'yellow'),
      ev('t4', 30, 'Escalated', 'Area supervisor + district duty officer paged', 'Control Room 101', 'red'),
      ev('t5', 0, 'On-scene confirmation', 'Awaiting tender 14 water-on report', 'Fire Brigade', 'green', true),
    ],
  }),
  mk({
    id: 'ALRT-2450',
    title: 'Loitering Alert',
    subject: 'Two persons · ATM alcove',
    groupId: 'patrol',
    severity: 'medium',
    status: 'investigating',
    camera: 'C-207',
    confidence: 83.7,
    minutesAgo: 44,
    caseRef: 'PREV-902/2026',
    assignedTo: 'PSI K. Chauhan',
    details: 'Pair circling the bank-side ATM alcove for 12 min, masking faces when users exit. Matches skimming-prelude pattern of PREV-902.',
    notes: 'Plainclothes team en route; keep camera C-207 locked on alcove until they arrive.',
    evidence: [camC207, camC207],
    icon: Ban,
    relatedCameras: ['C-207', 'C-160'],
    journey: [],
    timeline: [
      ev('t1', 44, 'Loitering score high', '12 min dwell · 6 entry/exit cycles · face masking', 'Behavior Model v2.3', 'yellow'),
      ev('t2', 41, 'Pattern match', 'Similar to PREV-902 skimming prelude (Rajkot)', 'Crime Pattern DB', 'purple'),
      ev('t3', 39, 'Plainclothes assigned', 'PSI team ETA 6 min · observation only', 'Raopura CID', 'blue'),
    ],
  }),
  mk({
    id: 'ALRT-2449',
    title: 'ANPR Blacklist Hit',
    subject: 'GJ10DL9021',
    plate: 'GJ10DL9021',
    objectLabel: 'White Toyota Innova · 2020',
    groupId: 'watchlist',
    severity: 'high',
    status: 'acknowledged',
    camera: 'C-045',
    confidence: 94.7,
    minutesAgo: 51,
    watchlistList: 'Suspect Vehicles',
    assignedTo: 'PSI Mahesan',
    details: 'Seven unpaid challans + active court look-out notice. Vehicle entered AI corridor toward SG Highway at time of match.',
    notes: 'Register to owner’s brother; verify LOI compliance before citation.',
    evidence: [camC045, camC115],
    icon: BellRing,
    relatedCameras: ['C-115', 'C-007'],
    journey: [],
    timeline: [
      ev('t1', 51, 'Blacklist match', 'LOI + 7 challans · registry pulled in 0.4 s', 'ANPR C-045', 'orange'),
      ev('t2', 49, 'Acknowledged', 'Citation pack opened at terminal 2', 'PSI Mahesan', 'cyan'),
      ev('t3', 48, 'Follow-up queued', 'Verify owner identity before LOI handover', 'Court Cell', 'blue'),
    ],
  }),
  mk({
    id: 'ALRT-2448',
    title: 'VIP Movement Logged',
    subject: 'GJ09ZV0007',
    plate: 'GJ09ZV0007',
    objectLabel: 'White Toyota Fortuner · escort',
    groupId: 'watchlist',
    severity: 'info',
    status: 'resolved',
    camera: 'C-015',
    confidence: 95.1,
    minutesAgo: 58,
    watchlistList: 'VIP / Sensitive',
    assignedTo: 'SO Security',
    details: 'Passive watch only — Z-category protectee leg logged for route compliance. No alerts forwarded to field units by design.',
    notes: 'Routine. Logged for the movement register, week 36.',
    evidence: [camC015, camC038],
    icon: Star,
    relatedCameras: ['C-038', 'C-001'],
    journey: [stop(1, 63, 'C-038', 61, 'S'), stop(2, 58, 'C-015', 64, 'S')],
    timeline: [
      ev('t1', 58, 'Movement detected', 'Leg 2 of 3 on planned route — on time', 'ANPR C-015', 'blue'),
      ev('t2', 56, 'Route compliance OK', 'No deviation, escort intact (2 vehicles)', 'SO Security', 'green'),
      ev('t3', 50, 'Resolved', 'No action required · register entry #4471', 'SO Security', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2447',
    title: 'Congestion Alert',
    subject: 'Queue · 1.4 km tailback',
    groupId: 'traffic',
    severity: 'info',
    status: 'resolved',
    camera: 'C-001',
    confidence: 84.0,
    minutesAgo: 66,
    assignedTo: 'Traffic Control',
    details: 'School traffic + temporary lane closure (metro cabling) produced a 1.4 km tailback; cleared organically after signal retune.',
    notes: 'Adaptive signal plan ATSP-14 pushed two extra green phases northbound.',
    evidence: [camC001, camC007],
    icon: Activity,
    relatedCameras: ['C-007', 'C-052'],
    journey: [],
    timeline: [
      ev('t1', 66, 'Density threshold crossed', 'Level of service E sustained 6 min', 'Traffic Model', 'blue'),
      ev('t2', 63, 'Signal plan amended', 'ATSP-14 retune pushed to controllers', 'Traffic Control', 'cyan'),
      ev('t3', 55, 'Resolved', 'LOS back to C · queue dissipated', 'Traffic Control', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2446',
    title: 'Illegal Parking',
    subject: 'GJ21GH1102',
    plate: 'GJ21GH1102',
    objectLabel: 'Tata Ace · loading on bridge stretch',
    groupId: 'traffic',
    severity: 'medium',
    status: 'new',
    camera: 'C-089',
    confidence: 86.5,
    minutesAgo: 74,
    details: 'Mini-truck unloading on the Maninagar bridge taper — single lane lost, approach speed down 40%. Static 16 min and counting.',
    notes: 'Crane request if owner not found within 10 min.',
    evidence: [camC089, camC089],
    icon: Ban,
    relatedCameras: ['C-052', 'C-001'],
    journey: [],
    timeline: [
      ev('t1', 74, 'Obstruction detected', 'Lane blockage at taper · queue forming', 'Traffic Model', 'yellow'),
      ev('t2', 72, 'Owner traced', 'Registry SMS + PS call attempted', 'Vehicle Registry', 'blue'),
      ev('t3', 0, 'Crane dispatch decision', 'Timer 10:00 — awaiting owner response', 'Watch-1', 'orange', true),
    ],
  }),
  mk({
    id: 'ALRT-2445',
    title: 'Wrong Direction',
    subject: 'GJ14EF7788',
    plate: 'GJ14EF7788',
    objectLabel: 'Black Honda Activa · 2021',
    groupId: 'wrongdir',
    severity: 'high',
    status: 'new',
    camera: 'C-052',
    confidence: 91.2,
    minutesAgo: 81,
    heading: 'Against one-way · lakefront',
    details: 'Two-wheeler riding against flow on the Vastrapur lakefront one-way during morning walker peak; head-on risk with pedestrians.',
    notes: 'Lakefront is a designated no-entry stretch 06:00–10:00 — separate citation applies.',
    evidence: [camC052, camC052],
    icon: Navigation,
    relatedCameras: ['C-001', 'C-007'],
    journey: [],
    timeline: [
      ev('t1', 81, 'Wrong-way rider', 'Counter-flow 480 m along lakefront promenade', 'Behavior Model v2.3', 'orange'),
      ev('t2', 80, 'Pedestrian risk tag', 'Walker density 2.1 pax/m² on same stretch', 'Crowd Model', 'yellow'),
      ev('t3', 0, 'Operator acknowledgement', 'Unreviewed', 'Watch-2', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2444',
    title: 'Speed Violation',
    subject: 'GJ05FG3322',
    plate: 'GJ05FG3322',
    objectLabel: 'Grey Honda City · 2022',
    groupId: 'speed',
    severity: 'high',
    status: 'new',
    camera: 'C-038',
    confidence: 97.8,
    minutesAgo: 89,
    speedKph: 118,
    limitKph: 70,
    heading: 'S → N · lane 1',
    details: '118 km/h through the Gift City service road work zone; cone channelisation active. School-vehicle corridor 07:30–09:30 expired 59 min prior.',
    notes: 'Section-enforcement pair C-015→C-038 confirms mean 104 km/h over 3.9 km.',
    evidence: [camC038, camC015],
    icon: Gauge,
    relatedCameras: ['C-015', 'C-045'],
    journey: [stop(1, 95, 'C-015', 92, 'S'), stop(2, 89, 'C-038', 118, 'S → N', true)],
    timeline: [
      ev('t1', 89, 'Radar + section match', 'Spot 118 · mean 104 over 3.9 km segment', 'Section ENF', 'orange'),
      ev('t2', 88, 'Work-zone multiplier', 'Speed +48 → section 190 → citation ×2', 'Rules Engine', 'yellow'),
      ev('t3', 0, 'Operator acknowledgement', 'Unreviewed', 'Watch-1', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2443',
    title: 'No Number Plate',
    subject: 'Motorcycle · no plate',
    groupId: 'traffic',
    severity: 'medium',
    status: 'new',
    camera: 'C-131',
    confidence: 82.6,
    minutesAgo: 97,
    heading: 'E → W · service lane',
    details: 'Plate region empty on both bumpers, chin-mounted rider. Repeat corridor — 11 plateless detections from C-131 this week.',
    notes: 'Composite vehicle-type match attempted against recent stolen bike list — no hit.',
    evidence: [camC131, camC131],
    icon: ScanLine,
    relatedCameras: ['C-131', 'C-207'],
    journey: [],
    timeline: [
      ev('t1', 97, 'Plate absence detected', 'Front + rear ROI empty · 82.6%', 'ANPR C-131', 'yellow'),
      ev('t2', 96, 'Soft-match attempted', 'Bike class + rider gait — no list hit', 'Investigation Graph', 'blue'),
      ev('t3', 0, 'Operator acknowledgement', 'Unreviewed', 'Rajkot West Watch', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2442',
    title: 'Suspicious Loitering',
    subject: 'Vehicle circling ATC lot',
    plate: 'GJ01YZ5544',
    objectLabel: 'White Dzire · windows tinted',
    groupId: 'patrol',
    severity: 'medium',
    status: 'new',
    camera: 'C-007',
    confidence: 85.3,
    minutesAgo: 106,
    details: 'Slow circuit of the ATC parking perimeter four times in 18 min, stops at staff gate, camera pans back to main road. Case-file watch item.',
    notes: 'Field surveillance suggestion raised; no overt contact until team arrives.',
    evidence: [camC007, camC001],
    icon: Siren,
    relatedCameras: ['C-001', 'C-052'],
    journey: [],
    timeline: [
      ev('t1', 106, 'Perimeter circling', '4 laps · mean 11 km/h · repeated staff-gate dwell', 'Behavior Model v2.3', 'yellow'),
      ev('t2', 104, 'Case linkage', 'Pattern flagged under ATC-area watch item W-19', 'Crime Branch', 'purple'),
      ev('t3', 0, 'Surveillance decision', 'Field team or photo verification — Watch-2', 'Watch-2', 'blue', true),
    ],
  }),
  mk({
    id: 'ALRT-2441',
    title: 'Red Light Violation',
    subject: 'GJ19KK0093',
    plate: 'GJ19KK0093',
    objectLabel: 'White Ertiga · 2023',
    groupId: 'redlight',
    severity: 'medium',
    status: 'resolved',
    camera: 'C-045',
    confidence: 93.0,
    minutesAgo: 118,
    heading: 'E → W · amber overrun 0.8 s',
    details: 'Borderline stop-line overrun — driver contested amber interval. Frame audit confirmed legal yellow; citation voided.',
    notes: 'Signal timing ticket raised for yellow-interval review at Iskcon west approach.',
    evidence: [camC045, camC045],
    icon: CircleSlash,
    relatedCameras: ['C-052', 'C-115'],
    journey: [],
    timeline: [
      ev('t1', 118, 'Stop-line overrun', 'Crossed 0.8 s into red phase', 'Signal Cam C-045', 'yellow'),
      ev('t2', 111, 'Driver contest received', 'Yellow interval disputed via app ticket 88941', 'TATW Portal', 'blue'),
      ev('t3', 100, 'Audit completed', 'Interval out of spec — citation withdrawn', 'Traffic Branch', 'green'),
      ev('t4', 98, 'Resolved', 'Voided; signal timing change request logged', 'PSI Mahesan', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2440',
    title: 'Watchlist Cleared',
    subject: 'GJ05JK6789',
    plate: 'GJ05JK6789',
    objectLabel: 'Black Hyundai Verna · 2021',
    groupId: 'watchlist',
    severity: 'medium',
    status: 'resolved',
    camera: 'C-015',
    confidence: 92.5,
    minutesAgo: 274,
    time: '06:12:33 AM',
    ago: '4.6 hr ago',
    watchlistList: 'Suspect Vehicles',
    assignedTo: 'SO Rathi',
    details: 'Early-hours suspected hit on Suspect Vehicles list. Frame audit showed partial plate occlusion — true plate GJ05JK6799, one digit misread.',
    notes: 'False positive recorded for model tuning; owner notified — no action.',
    evidence: [camC015, vehicleSnapshot],
    icon: ShieldCheck,
    relatedCameras: ['C-038', 'C-001'],
    journey: [],
    timeline: [
      ev('t1', 274, 'ANPR hit proposed', '92.5% vs Suspect Vehicles list', 'Edge Node G-02', 'orange'),
      ev('t2', 271, 'Manual audit', 'Occlusion on 5th glyph · re-read to GJ05JK6799', 'SO Rathi', 'cyan'),
      ev('t3', 268, 'Resolved — false positive', 'Owner verified in registry; sample sent to tuning', 'SO Rathi', 'green'),
    ],
  }),
  mk({
    id: 'ALRT-2439',
    title: 'Crowd Detected',
    subject: 'Walkers surge · gate 2',
    groupId: 'crowd',
    severity: 'info',
    status: 'new',
    camera: 'C-052',
    confidence: 80.7,
    minutesAgo: 133,
    details: 'Morning-walker footfall 3.2× baseline at lake gate 2 — weekday event spillover from nearby ground. Density below alarm tier.',
    notes: 'Monitor only; escalate if 2.8 pax/m² is held for 10 min.',
    evidence: [camC052, camC001],
    icon: UsersRound,
    relatedCameras: ['C-001', 'C-089'],
    journey: [],
    timeline: [
      ev('t1', 133, 'Footfall spike', '3.2× baseline · 240 persons in 15 min', 'Crowd Model', 'blue'),
      ev('t2', 130, 'Context tag added', 'Event at nearby ground confirmed via PS log', 'Watch-2', 'cyan'),
    ],
  }),
];

/* ------------------------------------------------------------------ *
 * KPI strip — values derived live from the alert list
 * ------------------------------------------------------------------ */

export interface AlertKpis {
  total: number;
  critical: number;
  high: number;
  medium: number;
  resolved: number;
  unreviewed: number;
}

export function computeKpis(list: AlertRecord[]): AlertKpis {
  return {
    total: list.length,
    critical: list.filter((a) => a.severity === 'critical').length,
    high: list.filter((a) => a.severity === 'high').length,
    medium: list.filter((a) => a.severity === 'medium').length,
    resolved: list.filter((a) => a.status === 'resolved').length,
    unreviewed: list.filter((a) => a.status === 'new').length,
  };
}

/* ------------------------------------------------------------------ *
 * Bottom-row analytics inputs
 * ------------------------------------------------------------------ */

export function computeTypeBars(list: AlertRecord[]): Array<{ id: AlertGroupId; label: string; value: number; color: string }> {
  return alertTypeGroups
    .map((group) => ({
      ...group,
      value: list.filter((alert) => alert.groupId === group.id).length,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Alerts per hour, 23:00 → 10:00 (rolling 12 h ending at the reference clock). */
export const alertsOverTime: AlertTimePoint[] = [
  { label: '11P', value: 0 },
  { label: '12A', value: 0 },
  { label: '1A', value: 0 },
  { label: '2A', value: 0 },
  { label: '3A', value: 0 },
  { label: '4A', value: 1 },
  { label: '5A', value: 0 },
  { label: '6A', value: 1 },
  { label: '7A', value: 0 },
  { label: '8A', value: 2 },
  { label: '9A', value: 8 },
  { label: '10A', value: 12 },
];

/** Last-24-h incident load by camera area (drives the Top Alert Locations list). */
export const topAlertLocations: TopAlertLocation[] = [
  { id: 'l1', rank: 1, name: 'Maninagar Junction', city: 'Ahmedabad', alerts: 3, peak: '09:40–10:45', trend: 'up' },
  { id: 'l2', rank: 2, name: 'Iskcon Circle', city: 'Ahmedabad', alerts: 3, peak: '08:48–10:20', trend: 'flat' },
  { id: 'l3', rank: 3, name: 'Vastrapur Lake Road', city: 'Ahmedabad', alerts: 3, peak: '08:33–10:25', trend: 'up' },
  { id: 'l4', rank: 4, name: 'Kudasan Road', city: 'Gandhinagar', alerts: 3, peak: '06:12–10:32', trend: 'down' },
  { id: 'l5', rank: 5, name: 'Gift City Road', city: 'Gandhinagar', alerts: 2, peak: '09:17–10:44', trend: 'up' },
  { id: 'l6', rank: 6, name: 'Shahibaug Road', city: 'Ahmedabad', alerts: 2, peak: '09:28–10:28', trend: 'flat' },
  { id: 'l7', rank: 7, name: 'Vadodara City Center', city: 'Vadodara', alerts: 2, peak: '09:02–10:39', trend: 'up' },
  { id: 'l8', rank: 8, name: 'Kalawad Road', city: 'Rajkot', alerts: 2, peak: '09:09–10:13', trend: 'down' },
];

/** Camera registry used by the location filter select. */
export const alertCameraOptions = Object.entries(CAMERAS).map(([code, meta]) => ({
  code,
  label: `${code} · ${meta.location}, ${meta.city}`,
}));

/* ------------------------------------------------------------------ *
 * Live activity stream pools (AI / ANPR ingest ticker)
 * ------------------------------------------------------------------ */

export const activityPool: Array<{
  text: (subject: string) => string;
  plate: boolean;
  camera: string;
  icon: AlertRecord['icon'];
  tone: 'info' | 'watchlist' | 'alert' | 'warning';
}> = [
  { text: (p) => `ANPR read ${p}`, plate: true, camera: 'C-001', icon: ScanLine, tone: 'info' },
  { text: (p) => `ANPR read ${p}`, plate: true, camera: 'C-052', icon: ScanLine, tone: 'info' },
  { text: (p) => `ANPR read ${p}`, plate: true, camera: 'C-207', icon: ScanLine, tone: 'info' },
  { text: (p) => `Speed sample ${p} · 61 km/h`, plate: true, camera: 'C-115', icon: Gauge, tone: 'info' },
  { text: (p) => `Watchlist scan ${p} — no match`, plate: true, camera: 'C-038', icon: ShieldAlert, tone: 'warning' },
  { text: (p) => `Blacklist scan ${p} — 1 open challan`, plate: true, camera: 'C-045', icon: BellRing, tone: 'alert' },
  { text: () => `Crowd density 2.4 pax/m² · stable`, plate: false, camera: 'C-089', icon: UsersRound, tone: 'info' },
  { text: () => `Helmet check — 6 riders cleared`, plate: false, camera: 'C-007', icon: Bike, tone: 'info' },
  { text: () => `Busker-group pattern at footbridge`, plate: false, camera: 'C-052', icon: Siren, tone: 'alert' },
  { text: () => `Fire model heartbeat OK · 0.9 s`, plate: false, camera: 'C-160', icon: Flame, tone: 'info' },
  { text: () => `Wrong-way check cleared · 0 counter-flow`, plate: false, camera: 'C-015', icon: Navigation, tone: 'info' },
  { text: () => `Night-cam IR gain auto-tuned`, plate: false, camera: 'C-131', icon: Camera, tone: 'warning' },
];

/** Plates the ticker recycles (kept consistent with the ANPR seed on Live View). */
export const activityPlates = [
  'GJ01AB1234',
  'GJ05JK6789',
  'GJ18CD4521',
  'GJ07HJ5566',
  'GJ10DL9021',
  'GJ19KK0093',
  'GJ01KL4477',
  'GJ03BM8890',
  'GJ06PQ2210',
  'GJ05FG3322',
];

