import {
  AlertTriangle,
  Ban,
  CarFront,
  Gauge,
  ScanLine,
  ShieldAlert,
  UserRound,
} from 'lucide-react';

import camC045 from '@/assets/cam-c045.jpg';
import camC052 from '@/assets/cam-c052.jpg';
import camC089 from '@/assets/cam-c089.jpg';
import camC115 from '@/assets/cam-c115.jpg';
import camC131 from '@/assets/cam-c131.jpg';
import camC160 from '@/assets/cam-c160.jpg';
import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';
import wlCarGrey from '@/assets/wl-car-grey.jpg';
import wlPerson1 from '@/assets/wl-person-1.jpg';
import wlPerson2 from '@/assets/wl-person-2.jpg';
import wlSuvBlack from '@/assets/wl-suv-black.jpg';
import wlSuvWhite from '@/assets/wl-suv-white.jpg';

import { mapCameraNodes, trackedRoute } from '@/data/cameraMapData';
import { worldToLatLng } from '@/data/gisProjection';

import type {
  Association,
  CameraFrequencyRow,
  EvidenceItem,
  InvestigationAnalytics,
  InvestigationDossier,
  InvestigationTarget,
  LocationDistributionSlice,
  RelatedEvent,
  RecentInvestigation,
  RouteAnalysis,
  RouteLeg,
  SearchCandidate,
  SightingQuery,
  SightingSortDir,
  SightingSortKey,
  TimeBucket,
  VehicleSighting,
} from '@/types/investigation';

/* ------------------------------------------------------------------ *
 * Time helpers. The console narrative "now" is 10:46:03 AM, 01 Sep 2026
 * — the same reference clock the Alerts workspace uses.
 * ------------------------------------------------------------------ */

const BASE = 10 * 3600 + 46 * 60 + 3;

/** Seconds after midnight, so every duration / sort is exact arithmetic. */
export const t = (h: number, m: number, s: number) => h * 3600 + m * 60 + s;

export function clockOf(seconds: number): string {
  const s = ((seconds % 86400) + 86400) % 86400;
  const h24 = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(sec)} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

export function agoOf(seconds: number): string {
  const diff = Math.max(0, BASE - seconds);
  if (diff < 60) return 'just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${(mins / 60).toFixed(1)} hr ago`;
}

export function durationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} hr ${m} min ${sec} s`;
  if (m > 0) return `${m} min ${sec} s`;
  return `${sec} s`;
}

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

/** Screen space has +y pointing south, so north is `-dy`. */
export function compassOf(dx: number, dy: number): { bearing: number; label: string } {
  const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalised = (bearing + 360) % 360;
  const label = COMPASS[Math.round(normalised / 22.5) % 16];
  return { bearing: Math.round(normalised), label };
}

/* ------------------------------------------------------------------ *
 * GIS seam: the mini-map is drawn in the 1600 × 1000 world of
 * `gisGeometry`. The affine fit between that world and the Ahmedabad–
 * Gandhinagar belt (C-001 Shahibaug ↔ C-038 GIFT City) lives in
 * `data/gisProjection.ts`, shared with the Camera Health console, so
 * every sighting already carries lat/lng for the day real tiles land.
 * Re-exported here so the investigation API is unchanged.
 * ------------------------------------------------------------------ */

export { worldToLatLng } from '@/data/gisProjection';

/* ------------------------------------------------------------------ *
 * Camera registry (single source: the GIS camera network)
 * ------------------------------------------------------------------ */

const cameraById = new Map(mapCameraNodes.map((camera) => [camera.id, camera]));

const zones: Record<string, string> = {
  Shahibaug: 'Zone I · Shahibaug',
  Navrangpura: 'Zone II · Navrangpura',
  Naranpura: 'Zone II · Naranpura',
  Bodakdev: 'Zone IV · Bodakdev',
  Vastrapur: 'Zone III · Vastrapur',
  Satellite: 'Zone IV · Sarkhej',
  Maninagar: 'Zone VI · Maninagar',
  Aslali: 'Zone VII · Aslali',
  Chandkheda: 'Gandhinagar South · Chandkheda',
  Kudasan: 'Gandhinagar North · Kudasan',
  'Sector 21': 'Gandhinagar Sector 21',
  'GIFT City': 'Gandhinagar Sector 28',
};

/** Extra archived frames, rotated so every sighting has a distinct filmstrip. */
const framePool = [camC045, camC052, camC089, camC115, camC131, camC160];

interface RawSighting
  extends Omit<
    VehicleSighting,
    | 'location'
    | 'area'
    | 'city'
    | 'zone'
    | 'department'
    | 'x'
    | 'y'
    | 'lat'
    | 'lng'
    | 'thumbnail'
    | 'frames'
    | 'time'
    | 'clip'
  > {
  extraFrames?: number;
}

function sight(raw: RawSighting, index: number): VehicleSighting {
  const camera = cameraById.get(raw.cameraId);
  const x = camera?.x ?? 800;
  const y = camera?.y ?? 500;
  const geo = worldToLatLng(x, y);
  const stamp = clockOf(raw.seconds);
  const extra = raw.extraFrames ?? 2;
  return {
    ...raw,
    location: camera?.location ?? raw.cameraId,
    area: camera?.area ?? '—',
    city: camera?.city ?? 'Ahmedabad',
    zone: zones[camera?.area ?? ''] ?? `${camera?.city ?? 'Ahmedabad'} · ${camera?.area ?? 'unknown'}`,
    department: camera?.department ?? 'Traffic Branch',
    x,
    y,
    lat: geo.lat,
    lng: geo.lng,
    thumbnail: camera?.thumbnail ?? vehicleSnapshot,
    frames: Array.from({ length: extra }, (_, i) => framePool[(index + i) % framePool.length]),
    time: stamp,
    clip: `CLP-${raw.cameraId.replace('-', '')}-${stamp.replace(/[:\s]/g, '').replace('AM', 'A').replace('PM', 'P')}`,
  };
}

/* ------------------------------------------------------------------ *
 * Dossier 1 — GJ01AB1234 (the console's live watchlist investigation)
 * ------------------------------------------------------------------ */

const primarySightings: VehicleSighting[] = [
  {
    id: 'SG-1041',
    cameraId: 'C-001',
    seconds: t(10, 21, 15),
    confidence: 96.4,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'West',
    lane: 'Lane 2 · slow',
    speedKph: 48,
    legKm: 0,
    journeyStep: 1,
    extraFrames: 2,
  },
  {
    id: 'SG-1042',
    cameraId: 'C-001',
    seconds: t(10, 22, 3),
    confidence: 94.8,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'West',
    lane: 'Lane 2 · slow',
    speedKph: 46,
    legKm: 0,
    reRead: true,
    note: 'ANPR re-read 48 s later — same pass, second frame',
    extraFrames: 1,
  },
  {
    id: 'SG-1043',
    cameraId: 'C-346',
    seconds: t(10, 24, 3),
    confidence: 91.2,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-West',
    lane: 'Lane 1 · fast',
    speedKph: 51,
    legKm: 0,
    note: 'OCR variance 8.8% — queued for manual verification',
    extraFrames: 2,
  },
  {
    id: 'SG-1044',
    cameraId: 'C-342',
    seconds: t(10, 26, 41),
    confidence: 89.1,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-West',
    lane: 'Lane 3 · service',
    speedKph: 49,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-1045',
    cameraId: 'C-007',
    seconds: t(10, 28, 42),
    confidence: 97.1,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-West',
    lane: 'Lane 2 · slow',
    speedKph: 52,
    legKm: 5.7,
    journeyStep: 2,
    extraFrames: 2,
  },
  {
    id: 'SG-1046',
    cameraId: 'C-007',
    seconds: t(10, 29, 11),
    confidence: 95.3,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-West',
    lane: 'Lane 2 · slow',
    speedKph: 50,
    legKm: 0,
    reRead: true,
    extraFrames: 1,
  },
  {
    id: 'SG-1047',
    cameraId: 'C-399',
    seconds: t(10, 31, 26),
    confidence: 88.6,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-East',
    lane: 'Lane 2 · against flow',
    speedKph: 68,
    legKm: 0,
    note: 'Wrong-direction classification held for 11 s',
    extraFrames: 2,
  },
  {
    id: 'SG-1048',
    cameraId: 'C-403',
    seconds: t(10, 33, 5),
    confidence: 93.4,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 71,
    legKm: 0,
    extraFrames: 2,
  },
  {
    id: 'SG-1049',
    cameraId: 'C-015',
    seconds: t(10, 34, 18),
    confidence: 98.2,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 74,
    legKm: 6.7,
    journeyStep: 3,
    extraFrames: 2,
  },
  {
    id: 'SG-1050',
    cameraId: 'C-015',
    seconds: t(10, 34, 52),
    confidence: 96.9,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 72,
    legKm: 0,
    reRead: true,
    extraFrames: 1,
  },
  {
    id: 'SG-1051',
    cameraId: 'C-412',
    seconds: t(10, 37, 51),
    confidence: 87.9,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 66,
    legKm: 0,
    extraFrames: 2,
  },
  {
    id: 'SG-1052',
    cameraId: 'C-434',
    seconds: t(10, 41, 9),
    confidence: 90.4,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 58,
    legKm: 0,
    extraFrames: 2,
  },
  {
    id: 'SG-1053',
    cameraId: 'C-038',
    seconds: t(10, 43, 28),
    confidence: 95.9,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 60,
    legKm: 0,
    note: 'First partial read on the GIFT City gantry',
    extraFrames: 2,
  },
  {
    id: 'SG-1054',
    cameraId: 'C-038',
    seconds: t(10, 44, 3),
    confidence: 98.7,
    vehicleType: 'Car · Sedan',
    make: 'Maruti Swift Dzire',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 62,
    legKm: 9.4,
    journeyStep: 4,
    watchlistHit: true,
    note: 'Watchlist match — High Priority Vehicles (WL-001)',
    extraFrames: 3,
  },
].map(sight);

/* ------------------------------------------------------------------ *
 * Dossier 2 — GJ27RS3391 (convoy companion on the same corridor)
 * ------------------------------------------------------------------ */

const ertigaSightings: VehicleSighting[] = [
  {
    id: 'SG-2201',
    cameraId: 'C-342',
    seconds: t(10, 19, 44),
    confidence: 87.3,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'North-West',
    lane: 'Lane 3 · service',
    speedKph: 44,
    legKm: 0,
    journeyStep: 1,
    extraFrames: 1,
  },
  {
    id: 'SG-2202',
    cameraId: 'C-007',
    seconds: t(10, 21, 3),
    confidence: 91.8,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'North-West',
    lane: 'Lane 2 · slow',
    speedKph: 47,
    legKm: 3.1,
    extraFrames: 1,
  },
  {
    id: 'SG-2203',
    cameraId: 'C-399',
    seconds: t(10, 30, 44),
    confidence: 86.9,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'North-East',
    lane: 'Lane 2 · slow',
    speedKph: 64,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-2204',
    cameraId: 'C-403',
    seconds: t(10, 33, 47),
    confidence: 93.4,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'North-East',
    lane: 'Lane 2 · slow',
    speedKph: 69,
    legKm: 8.9,
    journeyStep: 2,
    extraFrames: 1,
  },
  {
    id: 'SG-2205',
    cameraId: 'C-412',
    seconds: t(10, 38, 39),
    confidence: 89.7,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 63,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-2206',
    cameraId: 'C-434',
    seconds: t(10, 42, 26),
    confidence: 91.2,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 55,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-2207',
    cameraId: 'C-038',
    seconds: t(10, 46, 18),
    confidence: 96.4,
    vehicleType: 'Car · MUV',
    make: 'Maruti Ertiga',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 59,
    legKm: 7.8,
    journeyStep: 3,
    extraFrames: 1,
  },
].map(sight);

/* ------------------------------------------------------------------ *
 * Dossier 3 — GJ05JK6789 (stolen-vehicle watchlist entry, same gantries)
 * ------------------------------------------------------------------ */

const cretaSightings: VehicleSighting[] = [
  {
    id: 'SG-3301',
    cameraId: 'C-346',
    seconds: t(10, 7, 36),
    confidence: 93.2,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'North-West',
    lane: 'Lane 1 · fast',
    speedKph: 58,
    legKm: 0,
    journeyStep: 1,
    extraFrames: 1,
  },
  {
    id: 'SG-3302',
    cameraId: 'C-342',
    seconds: t(10, 12, 58),
    confidence: 91.7,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'North-West',
    lane: 'Lane 2 · slow',
    speedKph: 54,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-3303',
    cameraId: 'C-007',
    seconds: t(10, 17, 21),
    confidence: 95.4,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'North',
    lane: 'Lane 1 · fast',
    speedKph: 61,
    legKm: 4.9,
    journeyStep: 2,
    extraFrames: 1,
  },
  {
    id: 'SG-3304',
    cameraId: 'C-399',
    seconds: t(10, 26, 9),
    confidence: 88.4,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'North-East',
    lane: 'Lane 2 · slow',
    speedKph: 77,
    legKm: 9.2,
    journeyStep: 3,
    extraFrames: 1,
  },
  {
    id: 'SG-3305',
    cameraId: 'C-403',
    seconds: t(10, 33, 47),
    confidence: 92.1,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'North-East',
    lane: 'Lane 1 · fast',
    speedKph: 81,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-3306',
    cameraId: 'C-115',
    seconds: t(10, 42, 11),
    confidence: 97.3,
    vehicleType: 'Car · SUV',
    make: 'Hyundai Creta',
    direction: 'South',
    lane: 'Lane 1 · fast',
    speedKph: 92,
    legKm: 14.6,
    journeyStep: 4,
    note: 'Speed violation — 92 km/h against a 60 km/h limit',
    extraFrames: 2,
  },
].map(sight);

/* ------------------------------------------------------------------ *
 * Dossier 4 — GJ18CD4521 (suspect vehicle, south-west Ahmedabad sweep)
 * ------------------------------------------------------------------ */

const boleroSightings: VehicleSighting[] = [
  {
    id: 'SG-4401',
    cameraId: 'C-160',
    seconds: t(10, 4, 18),
    confidence: 94.6,
    vehicleType: 'Car · SUV',
    make: 'Mahindra Bolero',
    direction: 'North',
    lane: 'Lane 2 · slow',
    speedKph: 63,
    legKm: 0,
    journeyStep: 1,
    extraFrames: 1,
  },
  {
    id: 'SG-4402',
    cameraId: 'C-089',
    seconds: t(10, 19, 2),
    confidence: 90.8,
    vehicleType: 'Car · SUV',
    make: 'Mahindra Bolero',
    direction: 'North-West',
    lane: 'Lane 1 · fast',
    speedKph: 57,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-4403',
    cameraId: 'C-045',
    seconds: t(10, 27, 44),
    confidence: 88.9,
    vehicleType: 'Car · SUV',
    make: 'Mahindra Bolero',
    direction: 'North-West',
    lane: 'Lane 2 · slow',
    speedKph: 52,
    legKm: 18.4,
    journeyStep: 2,
    extraFrames: 1,
  },
  {
    id: 'SG-4404',
    cameraId: 'C-052',
    seconds: t(10, 35, 26),
    confidence: 92.3,
    vehicleType: 'Car · SUV',
    make: 'Mahindra Bolero',
    direction: 'North',
    lane: 'Lane 1 · fast',
    speedKph: 49,
    legKm: 0,
    extraFrames: 1,
  },
  {
    id: 'SG-4405',
    cameraId: 'C-001',
    seconds: t(10, 44, 51),
    confidence: 95.7,
    vehicleType: 'Car · SUV',
    make: 'Mahindra Bolero',
    direction: 'East',
    lane: 'Lane 2 · slow',
    speedKph: 45,
    legKm: 8.1,
    journeyStep: 3,
    extraFrames: 1,
  },
].map(sight);

/* ------------------------------------------------------------------ *
 * Targets
 * ------------------------------------------------------------------ */

const primaryTarget: InvestigationTarget = {
  id: 'TGT-0914',
  plate: 'GJ01AB1234',
  make: 'Maruti',
  model: 'Swift Dzire',
  variant: 'VXi (AMT)',
  label: 'White Swift Dzire',
  color: 'White',
  year: 2019,
  vehicleClass: 'LMV · Sedan',
  fuel: 'Petrol',
  registeredOwner: 'Arjun Rathod',
  registrationState: 'Gujarat (GJ-01 Ahmedabad)',
  insuranceExpiry: '14 Feb 2026 · expired',
  fitnessExpiry: '02 Mar 2027',
  snapshot: vehicleSnapshot,
  confidence: 98.7,
  meanConfidence: 0,
  status: 'on-road',
  watchlist: {
    match: true,
    category: 'High Priority Vehicles',
    categoryId: 'high-priority',
    priority: 'critical',
    entryId: 'WL-001',
    addedOn: '02 Mar 2026',
    action: 'Intercept and inform SO Crime on positive match. Do not pursue beyond city limits without control-room clearance.',
  },
  attributes: [
    { label: 'Make / Model', value: 'Maruti Swift Dzire', confidence: 97 },
    { label: 'Colour', value: 'White (pearl)', confidence: 99 },
    { label: 'Body class', value: 'Sedan · LMV', confidence: 96 },
    { label: 'Plate OCR', value: 'GJ01AB1234', confidence: 99 },
    { label: 'Sticker / decal', value: 'None detected', confidence: 88 },
  ],
  history: [
    { label: 'Watchlist hits (30 d)', detail: '27 matches across 9 cameras', tone: 'red' },
    { label: 'Linked offences', detail: '3 ATM-skimming cases · Ahmedabad City Crime', tone: 'orange' },
    { label: 'Insurance', detail: 'Expired 14 Feb 2026 — no renewal on record', tone: 'yellow' },
    { label: 'Last intercept', detail: '19 Aug 2026 · Shahibaug — driver fled on foot', tone: 'purple' },
  ],
};

const ertigaTarget: InvestigationTarget = {
  ...primaryTarget,
  id: 'TGT-2207',
  plate: 'GJ27RS3391',
  make: 'Maruti',
  model: 'Ertiga',
  variant: 'ZXi',
  label: 'White Ertiga',
  year: 2021,
  vehicleClass: 'LMV · MUV',
  registeredOwner: 'Ketan Vaghela',
  snapshot: wlSuvWhite,
  confidence: 96.4,
  status: 'on-road',
  watchlist: {
    match: false,
    category: 'Not on watchlist',
    categoryId: 'none',
    priority: 'medium',
    entryId: '—',
    addedOn: '—',
    action: 'No standing instruction. Escort correlation only — verify before action.',
  },
  attributes: [
    { label: 'Make / Model', value: 'Maruti Ertiga', confidence: 94 },
    { label: 'Colour', value: 'White', confidence: 98 },
    { label: 'Body class', value: 'MUV · LMV', confidence: 93 },
    { label: 'Plate OCR', value: 'GJ27RS3391', confidence: 96 },
  ],
  history: [
    { label: 'Watchlist hits (30 d)', detail: '0 matches', tone: 'green' },
    { label: 'Corridor overlap', detail: 'Consecutive shared gantries with GJ01AB1234 across the NH-147 run', tone: 'orange' },
    { label: 'Registered owner', detail: 'Ketan Vaghela · Kalol, Gandhinagar', tone: 'blue' },
  ],
};

const cretaTarget: InvestigationTarget = {
  ...primaryTarget,
  id: 'TGT-3306',
  plate: 'GJ05JK6789',
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX (O)',
  label: 'Silver Creta',
  color: 'Silver',
  year: 2020,
  vehicleClass: 'LMV · SUV',
  registeredOwner: 'Vikram Solanki',
  snapshot: wlCarGrey,
  confidence: 97.3,
  status: 'on-road',
  watchlist: {
    match: true,
    category: 'Stolen Vehicles',
    categoryId: 'stolen',
    priority: 'high',
    entryId: 'WL-014',
    addedOn: '21 Jul 2026',
    action: 'Reported stolen 19 Jul 2026 · Satellite PS. Confirm occupancy and inform Highway Patrol.',
  },
  attributes: [
    { label: 'Make / Model', value: 'Hyundai Creta', confidence: 95 },
    { label: 'Colour', value: 'Silver (metallic)', confidence: 97 },
    { label: 'Body class', value: 'SUV · LMV', confidence: 96 },
    { label: 'Plate OCR', value: 'GJ05JK6789', confidence: 97 },
  ],
  history: [
    { label: 'Watchlist hits (30 d)', detail: '11 matches across 5 cameras', tone: 'red' },
    { label: 'Open offence', detail: 'Vehicle theft · Satellite PS 19 Jul 2026', tone: 'orange' },
    { label: 'Corridor overlap', detail: '5 shared gantries with GJ01AB1234', tone: 'orange' },
  ],
};

const boleroTarget: InvestigationTarget = {
  ...primaryTarget,
  id: 'TGT-4405',
  plate: 'GJ18CD4521',
  make: 'Mahindra',
  model: 'Bolero',
  variant: 'Neo N10',
  label: 'Black Bolero',
  color: 'Black',
  year: 2018,
  vehicleClass: 'LMV · SUV',
  registeredOwner: 'Bharat Chaudhary',
  snapshot: wlSuvBlack,
  confidence: 95.7,
  status: 'parked',
  watchlist: {
    match: true,
    category: 'Suspect Vehicles',
    categoryId: 'suspect',
    priority: 'medium',
    entryId: 'WL-077',
    addedOn: '09 Aug 2026',
    action: 'Suspect in two cargo-lift cases. Log sighting, no intercept without DCP clearance.',
  },
  attributes: [
    { label: 'Make / Model', value: 'Mahindra Bolero', confidence: 93 },
    { label: 'Colour', value: 'Black', confidence: 96 },
    { label: 'Body class', value: 'SUV · LMV', confidence: 94 },
    { label: 'Plate OCR', value: 'GJ18CD4521', confidence: 95 },
  ],
  history: [
    { label: 'Watchlist hits (30 d)', detail: '6 matches across 4 cameras', tone: 'orange' },
    { label: 'Open offence', detail: '2 cargo-lift cases · Maninagar PS', tone: 'orange' },
    { label: 'Corridor overlap', detail: '1 shared gantry with GJ01AB1234', tone: 'yellow' },
  ],
};

/* ------------------------------------------------------------------ *
 * Related events (linked to the same vehicle)
 * ------------------------------------------------------------------ */

/** Related-event seeds carry `seconds`; wall-clock strings are derived. */
type RawEvent = Omit<RelatedEvent, 'time'>;

const withTimes = (rows: RawEvent[]): RelatedEvent[] =>
  rows.map((row) => ({ ...row, time: clockOf(row.seconds) }));

const primaryEvents: RelatedEvent[] = withTimes([
  {
    id: 'EVT-9001',
    title: 'Watchlist Match',
    severity: 'critical',
    tone: 'red',
    cameraId: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    seconds: t(10, 44, 3),
    confidence: 98.7,
    detail:
      'ANPR read matched WL-001 (High Priority Vehicles) on the GIFT City gantry. Frame, 38 s clip and OCR trace archived to the case bundle.',
    metric: '98.7% OCR · 1.4 s match',
    alertId: 'ALRT-2461',
    sightingId: 'SG-1054',
    thumbnail: cameraById.get('C-038')?.thumbnail ?? vehicleSnapshot,
    icon: ShieldAlert,
    acknowledged: false,
  },
  {
    id: 'EVT-9002',
    title: 'Speed Violation',
    severity: 'high',
    tone: 'orange',
    cameraId: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    seconds: t(10, 34, 18),
    confidence: 98.2,
    detail:
      'Average-speed enforcement flagged 74 km/h against a 60 km/h limit on the Kudasan corridor; section speed computed across C-403 → C-015.',
    metric: '74 km/h vs 60 km/h (+23%)',
    alertId: 'ALRT-2458',
    sightingId: 'SG-1049',
    thumbnail: cameraById.get('C-015')?.thumbnail ?? vehicleSnapshot,
    icon: Gauge,
    acknowledged: true,
  },
  {
    id: 'EVT-9003',
    title: 'Wrong Direction',
    severity: 'medium',
    tone: 'purple',
    cameraId: 'C-399',
    location: 'NH-147 · Node 2',
    city: 'Gandhinagar',
    seconds: t(10, 31, 26),
    confidence: 88.6,
    detail:
      'Vehicle tracked in lane 2 against the declared flow for 11 s while overtaking a heavy vehicle; classification confidence 88.6%.',
    metric: '11 s against flow · lane 2',
    alertId: 'ALRT-2452',
    sightingId: 'SG-1047',
    thumbnail: cameraById.get('C-399')?.thumbnail ?? vehicleSnapshot,
    icon: AlertTriangle,
    acknowledged: false,
  },
  {
    id: 'EVT-9004',
    title: 'Red Light Violation',
    severity: 'medium',
    tone: 'blue',
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    seconds: t(10, 21, 15),
    confidence: 96.4,
    detail:
      'Stop-line crossing recorded 3.4 s after the signal turned red at the Shahibaug junction; two evidence frames retained.',
    metric: '3.4 s after red',
    alertId: 'ALRT-2449',
    sightingId: 'SG-1041',
    thumbnail: cameraById.get('C-001')?.thumbnail ?? vehicleSnapshot,
    icon: Ban,
    acknowledged: true,
  },
  {
    id: 'EVT-9005',
    title: 'ANPR Plate Variance',
    severity: 'info',
    tone: 'cyan',
    cameraId: 'C-346',
    location: 'Ashram Road · Node 3',
    city: 'Ahmedabad',
    seconds: t(10, 24, 3),
    confidence: 91.2,
    detail:
      'OCR returned 91.2% with an 8.8% glyph variance on the last digit; the read was retained after cross-camera confirmation at C-007.',
    metric: 'OCR variance 8.8%',
    alertId: 'ALRT-2444',
    sightingId: 'SG-1043',
    thumbnail: cameraById.get('C-346')?.thumbnail ?? vehicleSnapshot,
    icon: ScanLine,
    acknowledged: true,
  },
]);

const secondaryEvents: RelatedEvent[] = withTimes([
  {
    id: 'EVT-9102',
    title: 'Speed Violation',
    severity: 'high',
    tone: 'orange',
    cameraId: 'C-115',
    location: 'S.G. Highway',
    city: 'Ahmedabad',
    seconds: t(10, 42, 11),
    confidence: 97.3,
    detail: 'Average-speed enforcement recorded 92 km/h against a 60 km/h limit on S.G. Highway.',
    metric: '92 km/h vs 60 km/h',
    alertId: 'ALRT-2459',
    sightingId: 'SG-3306',
    thumbnail: camC115,
    icon: Gauge,
    acknowledged: false,
  },
  {
    id: 'EVT-9103',
    title: 'Watchlist Match',
    severity: 'high',
    tone: 'red',
    cameraId: 'C-346',
    location: 'Ashram Road · Node 3',
    city: 'Ahmedabad',
    seconds: t(10, 7, 36),
    confidence: 93.2,
    detail: 'Matched WL-014 (Stolen Vehicles) on the Navrangpura gantry at the start of the reconstructed run.',
    metric: '93.2% OCR',
    alertId: 'ALRT-2431',
    sightingId: 'SG-3301',
    thumbnail: cameraById.get('C-346')?.thumbnail ?? wlCarGrey,
    icon: ShieldAlert,
    acknowledged: true,
  },
]);

const boleroEvents: RelatedEvent[] = withTimes([
  {
    id: 'EVT-9204',
    title: 'Suspect Vehicle Sight',
    severity: 'medium',
    tone: 'orange',
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    seconds: t(10, 44, 51),
    confidence: 95.7,
    detail: 'Suspect-vehicle watchlist read on the Shahibaug gantry; vehicle stationary at the kerb for 4 minutes.',
    metric: 'Parked 4 min · kerb side',
    alertId: 'ALRT-2462',
    sightingId: 'SG-4405',
    thumbnail: cameraById.get('C-001')?.thumbnail ?? wlSuvBlack,
    icon: CarFront,
    acknowledged: false,
  },
]);

const ertigaEvents: RelatedEvent[] = withTimes([
  {
    id: 'EVT-9305',
    title: 'Convoy Correlation',
    severity: 'info',
    tone: 'cyan',
    cameraId: 'C-403',
    location: 'NH-147 · Node 3',
    city: 'Gandhinagar',
    seconds: t(10, 33, 47),
    confidence: 93.4,
    detail: 'Tracking engine paired this vehicle with GJ01AB1234 for 6 consecutive gantries (convoy candidate).',
    metric: '42 s behind target',
    alertId: 'ALRT-2457',
    sightingId: 'SG-2204',
    thumbnail: cameraById.get('C-403')?.thumbnail ?? wlSuvWhite,
    icon: ScanLine,
    acknowledged: false,
  },
]);

/* ------------------------------------------------------------------ *
 * Dossiers
 * ------------------------------------------------------------------ */

/** World-space polyline legs for the mini-map overlay. */
export interface DossierLegs {
  points: Array<[number, number]>;
  critical?: boolean;
}

/** Straight legs are good enough until the route geometry service exists. */
const straightLegs = (nodes: VehicleSighting[]): DossierLegs[] =>
  nodes.slice(0, -1).map((node, i) => ({
    points: [
      [node.x, node.y],
      [nodes[i + 1].x, nodes[i + 1].y],
    ],
  }));

interface DossierMeta {
  status?: InvestigationDossier['status'];
  priority?: InvestigationDossier['priority'];
  openedBy?: string;
  openedAt?: string;
  unit?: string;
}

function buildDossier(
  caseId: string,
  title: string,
  target: InvestigationTarget,
  sightings: VehicleSighting[],
  events: RelatedEvent[],
  legs: DossierLegs[],
  meta: DossierMeta = {},
): InvestigationDossier & { legs: DossierLegs[] } {
  const mean =
    sightings.reduce((sum, sighting) => sum + sighting.confidence, 0) / Math.max(1, sightings.length);
  return {
    caseId,
    title,
    openedBy: meta.openedBy ?? 'Insp. Rajveer',
    openedAt: meta.openedAt ?? clockOf(BASE - 24 * 60),
    unit: meta.unit ?? 'Gandhinagar Command · Control Room 2',
    status: meta.status ?? 'active',
    priority: meta.priority ?? target.watchlist.priority,
    target: { ...target, meanConfidence: Number(mean.toFixed(1)) },
    sightings,
    events,
    associations: [],
    legs,
  };
}

const primaryBase = buildDossier(
  'INV-2026-0914',
  'Watchlist match · Ahmedabad → GIFT City corridor',
  primaryTarget,
  primarySightings,
  primaryEvents,
  trackedRoute.legs,
);

const ertigaBase = buildDossier(
  'INV-2026-0871',
  'Convoy correlation · NH-147 Chandkheda',
  ertigaTarget,
  ertigaSightings,
  ertigaEvents,
  straightLegs(primaryRoute(ertigaSightings)),
  { priority: 'medium' },
);

const cretaBase = buildDossier(
  'INV-2026-0842',
  'Stolen vehicle · S.G. Highway southbound',
  cretaTarget,
  cretaSightings,
  secondaryEvents,
  straightLegs(primaryRoute(cretaSightings)),
  { priority: 'high', openedAt: clockOf(BASE - 41 * 60) },
);

const boleroBase = buildDossier(
  'INV-2026-0799',
  'Suspect vehicle · south-west Ahmedabad sweep',
  boleroTarget,
  boleroSightings,
  boleroEvents,
  straightLegs(primaryRoute(boleroSightings)),
  { priority: 'medium', status: 'monitoring', openedAt: clockOf(BASE - 62 * 60) },
);

/** Cameras a dossier's target was read on — the co-detection basis. */
const camerasOf = (base: InvestigationDossier) => new Set(base.sightings.map((s) => s.cameraId));

interface RawAssociation
  extends Omit<Association, 'sightings' | 'score' | 'icon' | 'thumbnail' | 'targetId'> {
  icon?: Association['icon'];
  thumbnail: string;
  /** Vehicle seeds resolve to another dossier; person seeds attach to one owner. */
  targetId?: string;
  ownerOf?: string;
}

const associationSeeds: RawAssociation[] = [
  {
    id: 'ASC-71',
    kind: 'convoy',
    kindLabel: 'Convoy / escort',
    label: 'GJ27RS3391',
    sub: 'White Maruti Ertiga · LMV MUV',
    detail:
      'Runs the same NH-147 → GIFT City corridor in close formation, matched two lane changes and held at the same service bay. Not on any watchlist — escort correlation only.',
    tone: 'orange',
    watchlist: false,
    thumbnail: wlSuvWhite,
    targetId: 'GJ27RS3391',
    icon: CarFront,
  },
  {
    id: 'ASC-72',
    kind: 'same-camera',
    kindLabel: 'Same gantries',
    label: 'GJ05JK6789',
    sub: 'Silver Hyundai Creta · LMV SUV',
    detail:
      'Read on the same ANPR gantries while working the Navrangpura → Chandkheda leg, then south on S.G. Highway. Flagged in Stolen Vehicles (WL-014, reported 19 Jul 2026).',
    tone: 'red',
    watchlist: true,
    thumbnail: wlCarGrey,
    targetId: 'GJ05JK6789',
    icon: ShieldAlert,
  },
  {
    id: 'ASC-73',
    kind: 'time-correlated',
    kindLabel: 'Time correlated',
    label: 'GJ18CD4521',
    sub: 'Black Mahindra Bolero · LMV SUV',
    detail:
      'Suspect-vehicle entry (WL-077) sweeping south-west Ahmedabad on a fixed offset behind the target and holding at the kerb — consistent with a look-out / pick-up role.',
    tone: 'yellow',
    watchlist: true,
    thumbnail: wlSuvBlack,
    targetId: 'GJ18CD4521',
    icon: Gauge,
  },
  {
    id: 'ASC-76',
    kind: 'same-camera',
    kindLabel: 'Same gantries',
    label: 'GJ01AB1234',
    sub: 'White Maruti Swift Dzire · LMV Sedan',
    detail:
      'Primary watchlist target of INV-2026-0914 (WL-001, High Priority Vehicles, 27 matches in 30 days). Shares this vehicle’s gantries on the Ahmedabad → Gandhinagar run.',
    tone: 'red',
    watchlist: true,
    thumbnail: vehicleSnapshot,
    targetId: 'GJ01AB1234',
    icon: ShieldAlert,
  },
  {
    id: 'ASC-74',
    kind: 'registered-owner',
    kindLabel: 'Registered owner',
    label: 'Arjun Rathod',
    sub: 'Person · 34 yrs · Kalol, Gandhinagar',
    detail:
      'Registered owner of GJ01AB1234 and a Wanted Persons entry (WL-003). Last matched on face recognition at C-089 Maninagar at 10:31:47 AM.',
    tone: 'purple',
    watchlist: true,
    thumbnail: wlPerson1,
    ownerOf: 'GJ01AB1234',
    icon: UserRound,
  },
  {
    id: 'ASC-75',
    kind: 'registered-owner',
    kindLabel: 'Registered owner',
    label: 'Vikram Solanki',
    sub: 'Person · 41 yrs · Satellite, Ahmedabad',
    detail:
      'Registered owner of GJ05JK6789 and a Known Criminals entry (WL-022). Face match raised at C-045 Iskcon Circle at 10:12:03 AM, 30 minutes before the vehicle read.',
    tone: 'red',
    watchlist: true,
    thumbnail: wlPerson2,
    ownerOf: 'GJ05JK6789',
    icon: UserRound,
  },
];

const dossierIndex: Record<string, InvestigationDossier> = {
  [primaryBase.target.plate]: primaryBase,
  [ertigaBase.target.plate]: ertigaBase,
  [cretaBase.target.plate]: cretaBase,
  [boleroBase.target.plate]: boleroBase,
};

/**
 * Co-detection graph. Shared-gantry counts are derived from the sightings, never
 * authored, so the ranking and the numbers on the cards always agree.
 */
function associationsFor(self: InvestigationDossier): Association[] {
  const own = camerasOf(self);
  return associationSeeds
    .filter((seed) => (seed.ownerOf ? seed.ownerOf === self.target.plate : seed.targetId !== self.target.plate))
    .map((seed) => {
      const linked = seed.targetId ? dossierIndex[seed.targetId] : undefined;
      const shared = linked ? [...own].filter((code) => camerasOf(linked).has(code)) : [];
      return {
        ...seed,
        icon: seed.icon ?? CarFront,
        sightings: shared,
        score: seed.kind === 'registered-owner' ? 0 : shared.length,
      } satisfies Association;
    })
    .filter((association) => association.kind === 'registered-owner' || association.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Every investigation the console can open, keyed by its target plate. */
export const investigationDossiers: Record<string, InvestigationDossier> = Object.fromEntries(
  Object.entries(dossierIndex).map(([plate, base]) => [plate, { ...base, associations: associationsFor(base) }]),
);

/** World-space polyline legs for a dossier's primary route (mini-map overlay). */
export function dossierLegs(dossierValue: InvestigationDossier): DossierLegs[] {
  const own = (dossierValue as InvestigationDossier & { legs?: DossierLegs[] }).legs;
  if (own?.length) return own;
  const primary = dossierValue.sightings.filter((s) => s.journeyStep);
  return primary.slice(0, -1).map((node, i) => ({
    points: [
      [node.x, node.y],
      [primary[i + 1].x, primary[i + 1].y],
    ] as Array<[number, number]>,
  }));
}

export const defaultTargetPlate = 'GJ01AB1234';

/* ------------------------------------------------------------------ *
 * Recent investigations + search index
 * ------------------------------------------------------------------ */

export const recentInvestigations: RecentInvestigation[] = [
  {
    id: 'INV-2026-0914',
    label: 'GJ01AB1234',
    sub: 'Watchlist match · GIFT City',
    ago: '2 min ago',
    tone: 'red',
    targetId: 'GJ01AB1234',
  },
  {
    id: 'INV-2026-0898',
    label: 'GJ05JK6789',
    sub: 'Stolen vehicle · S.G. Highway',
    ago: '18 min ago',
    tone: 'orange',
    targetId: 'GJ05JK6789',
  },
  {
    id: 'INV-2026-0871',
    label: 'GJ27RS3391',
    sub: 'Convoy correlation · NH-147',
    ago: '41 min ago',
    tone: 'yellow',
    targetId: 'GJ27RS3391',
  },
  {
    id: 'INV-2026-0799',
    label: 'GJ18CD4521',
    sub: 'Suspect vehicle · Maninagar sweep',
    ago: '1 hr ago',
    tone: 'purple',
    targetId: 'GJ18CD4521',
  },
  {
    id: 'INV-2026-0755',
    label: 'Arjun Rathod',
    sub: 'Person of interest · WL-003',
    ago: '3 hr ago',
    tone: 'cyan',
    targetId: 'GJ01AB1234',
  },
];

export const searchCandidates: SearchCandidate[] = [
  {
    id: 'SC-1',
    kind: 'vehicle',
    label: 'GJ01AB1234',
    sub: 'White Maruti Swift Dzire · 2019',
    meta: '14 sightings · 10 cameras · watchlist',
    tone: 'red',
    targetId: 'GJ01AB1234',
    icon: CarFront,
  },
  {
    id: 'SC-2',
    kind: 'vehicle',
    label: 'GJ05JK6789',
    sub: 'Silver Hyundai Creta · 2020',
    meta: '6 sightings · 6 cameras · stolen',
    tone: 'orange',
    targetId: 'GJ05JK6789',
    icon: CarFront,
  },
  {
    id: 'SC-3',
    kind: 'vehicle',
    label: 'GJ27RS3391',
    sub: 'White Maruti Ertiga · 2021',
    meta: '7 sightings · 7 cameras · convoy',
    tone: 'yellow',
    targetId: 'GJ27RS3391',
    icon: CarFront,
  },
  {
    id: 'SC-4',
    kind: 'vehicle',
    label: 'GJ18CD4521',
    sub: 'Black Mahindra Bolero · 2018',
    meta: '5 sightings · 5 cameras · suspect',
    tone: 'purple',
    targetId: 'GJ18CD4521',
    icon: CarFront,
  },
  {
    id: 'SC-5',
    kind: 'camera',
    label: 'C-038',
    sub: 'Gift City Road · Gandhinagar',
    meta: 'watchlist match 10:44:03 AM · 98.7%',
    tone: 'red',
    targetId: 'GJ01AB1234',
    icon: ScanLine,
  },
  {
    id: 'SC-6',
    kind: 'camera',
    label: 'C-015',
    sub: 'Kudasan Road · Gandhinagar',
    meta: 'speed violation 74 km/h · 98.2%',
    tone: 'orange',
    targetId: 'GJ01AB1234',
    icon: ScanLine,
  },
  {
    id: 'SC-7',
    kind: 'camera',
    label: 'C-001',
    sub: 'Shahibaug Road · Ahmedabad',
    meta: 'journey origin 10:21:15 AM · 96.4%',
    tone: 'blue',
    targetId: 'GJ01AB1234',
    icon: ScanLine,
  },
  {
    id: 'SC-8',
    kind: 'camera',
    label: 'C-115',
    sub: 'S.G. Highway · Ahmedabad',
    meta: 'stolen-vehicle read 10:42:11 AM · 97.3%',
    tone: 'orange',
    targetId: 'GJ05JK6789',
    icon: ScanLine,
  },
  {
    id: 'SC-9',
    kind: 'person',
    label: 'Arjun Rathod',
    sub: 'Registered owner · GJ01AB1234',
    meta: 'Wanted Persons WL-003 · matched C-089',
    tone: 'purple',
    targetId: 'GJ01AB1234',
    icon: UserRound,
  },
  {
    id: 'SC-10',
    kind: 'person',
    label: 'Watchlist Match · Gift City',
    sub: 'Event ALRT-2461 · 10:44:03 AM',
    meta: 'critical · GJ01AB1234 · 98.7%',
    tone: 'red',
    targetId: 'GJ01AB1234',
    icon: ShieldAlert,
  },
  {
    id: 'SC-11',
    kind: 'person',
    label: 'Vikram Solanki',
    sub: 'Registered owner · GJ05JK6789',
    meta: 'Known Criminals WL-022 · matched C-045',
    tone: 'orange',
    targetId: 'GJ05JK6789',
    icon: UserRound,
  },
];

/** Location filter options for the console header (Gujarat operating areas). */
export const locationOptions = [
  { id: 'all', label: 'All Locations' },
  { id: 'Ahmedabad', label: 'Ahmedabad' },
  { id: 'Gandhinagar', label: 'Gandhinagar' },
  { id: 'Vadodara', label: 'Vadodara' },
  { id: 'Surat', label: 'Surat' },
  { id: 'Rajkot', label: 'Rajkot' },
];

export const dateRangeOptions = [
  { id: '30m', label: 'Last 30 min' },
  { id: '1h', label: 'Last 1 hour' },
  { id: '4h', label: 'Last 4 hours' },
  { id: 'day', label: 'Today · 01 Sep 2026' },
  { id: '7d', label: 'Last 7 days' },
];

/* ------------------------------------------------------------------ *
 * Derived intelligence (pure — swap for API responses later)
 * ------------------------------------------------------------------ */

export function primaryRoute(sightings: VehicleSighting[]): VehicleSighting[] {
  return sightings.filter((sighting) => sighting.journeyStep);
}

export function buildRouteLegs(
  sightings: VehicleSighting[],
  legs: DossierLegs[],
): RouteLeg[] {
  const nodes = primaryRoute(sightings);
  return nodes.slice(1).map((to, i) => {
    const from = nodes[i];
    const seconds = to.seconds - from.seconds;
    const km = to.legKm;
    return {
      index: i + 1,
      from,
      to,
      seconds,
      label: durationLabel(seconds),
      km,
      speedKph: seconds > 0 ? Number(((km / seconds) * 3600).toFixed(0)) : 0,
      points: legs[i]?.points ?? [
        [from.x, from.y],
        [to.x, to.y],
      ],
      critical: Boolean(legs[i]?.critical ?? to.watchlistHit),
    };
  });
}

export function computeRouteAnalysis(sightings: VehicleSighting[]): RouteAnalysis {
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const nodes = primaryRoute(sorted);
  const durationSec = last.seconds - first.seconds;
  const distanceKm = nodes.reduce((sum, node) => sum + node.legKm, 0);

  let longest = { label: '—', seconds: 0 };
  sorted.slice(1).forEach((sighting, i) => {
    const gap = sighting.seconds - sorted[i].seconds;
    if (gap > longest.seconds) {
      longest = { label: `${sorted[i].cameraId} → ${sighting.cameraId}`, seconds: gap };
    }
  });

  const heading = compassOf(last.x - first.x, last.y - first.y);
  const cities = [...new Set(sorted.map((s) => s.city))];
  const departments = [...new Set(sorted.map((s) => s.department))];
  const idleSec = BASE - last.seconds;

  return {
    durationSec,
    durationLabel: durationLabel(durationSec),
    camerasCrossed: new Set(sorted.map((s) => s.cameraId)).size,
    primaryNodes: nodes.length,
    distanceKm: Number(distanceKm.toFixed(1)),
    avgGapSec: sorted.length > 1 ? durationSec / (sorted.length - 1) : 0,
    avgGapLabel: durationLabel(sorted.length > 1 ? durationSec / (sorted.length - 1) : 0),
    avgSpeedKph: durationSec > 0 ? Number(((distanceKm / durationSec) * 3600).toFixed(0)) : 0,
    topSpeedKph: sorted.reduce((max, s) => Math.max(max, s.speedKph), 0),
    bearingDeg: heading.bearing,
    compass: heading.label,
    corridorLabel: `${first.city} → ${last.city}`,
    cities,
    zones: new Set(sorted.map((s) => s.zone)).size,
    departments,
    longestGap: { ...longest, seconds: longest.seconds },
    stationary: idleSec > 120,
  };
}

/** Headline values for the INVESTIGATION DETAILS rail. */
export function summariseInvestigation(dossierValue: InvestigationDossier) {
  const sorted = [...dossierValue.sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const best = sorted.reduce((top, s) => (s.confidence > top.confidence ? s : top), sorted[0]);
  const cameras = [...new Set(sorted.map((s) => s.cameraId))];
  const analysis = computeRouteAnalysis(sorted);
  return {
    first,
    last,
    best,
    cameras,
    analysis,
    detections: sorted.length,
    meanConfidence: dossierValue.target.meanConfidence,
    cities: analysis.cities,
  };
}

/* ---------------- sighting history: filter + sort ---------------- */

export const defaultSightingQuery: SightingQuery = {
  camera: 'all',
  city: 'all',
  minConfidence: 0,
  primaryOnly: false,
  query: '',
};

export function filterSightings(sightings: VehicleSighting[], query: SightingQuery): VehicleSighting[] {
  const q = query.query.trim().toLowerCase();
  return sightings.filter((sighting) => {
    if (query.camera !== 'all' && sighting.cameraId !== query.camera) return false;
    if (query.city !== 'all' && sighting.city !== query.city) return false;
    if (sighting.confidence < query.minConfidence) return false;
    if (query.primaryOnly && !sighting.journeyStep) return false;
    if (!q) return true;
    return (
      sighting.cameraId.toLowerCase().includes(q) ||
      sighting.location.toLowerCase().includes(q) ||
      sighting.area.toLowerCase().includes(q) ||
      sighting.city.toLowerCase().includes(q) ||
      sighting.direction.toLowerCase().includes(q) ||
      sighting.vehicleType.toLowerCase().includes(q)
    );
  });
}

const collator = new Intl.Collator('en', { numeric: true });

export function sortSightings(
  sightings: VehicleSighting[],
  key: SightingSortKey,
  dir: SightingSortDir,
): VehicleSighting[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...sightings].sort((a, b) => {
    switch (key) {
      case 'camera':
        return collator.compare(a.cameraId, b.cameraId) * factor || a.seconds - b.seconds;
      case 'location':
        return collator.compare(a.location, b.location) * factor || a.seconds - b.seconds;
      case 'confidence':
        return (a.confidence - b.confidence) * factor || a.seconds - b.seconds;
      case 'type':
        return collator.compare(a.vehicleType, b.vehicleType) * factor || a.seconds - b.seconds;
      case 'direction':
        return collator.compare(a.direction, b.direction) * factor || a.seconds - b.seconds;
      default:
        return (a.seconds - b.seconds) * factor;
    }
  });
}

/* ---------------- evidence manifest ---------------- */

export function buildEvidence(sightings: VehicleSighting[]): EvidenceItem[] {
  return [...sightings]
    .sort((a, b) => b.seconds - a.seconds)
    .map((sighting) => ({
      id: `EV-${sighting.id.slice(3)}`,
      sightingId: sighting.id,
      cameraId: sighting.cameraId,
      location: sighting.location,
      city: sighting.city,
      time: sighting.time,
      seconds: sighting.seconds,
      confidence: sighting.confidence,
      thumbnail: sighting.thumbnail,
      clip: sighting.clip,
      primary: Boolean(sighting.journeyStep),
      watchlistHit: Boolean(sighting.watchlistHit),
      tags: [
        sighting.journeyStep ? `route node ${sighting.journeyStep}` : 'corridor read',
        sighting.reRead ? 'ANPR re-read' : 'ANPR primary',
        sighting.watchlistHit ? 'watchlist' : sighting.confidence >= 95 ? 'high OCR' : 'standard OCR',
      ],
    }));
}

/* ---------------- bottom analytics ---------------- */

const locationColors = ['#2f7dff', '#22d3ee', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#eab308'];

export function computeInvestigationAnalytics(
  sightings: VehicleSighting[],
  bucketSec = 300,
): InvestigationAnalytics {
  const sorted = [...sightings].sort((a, b) => a.seconds - b.seconds);
  const first = sorted[0]?.seconds ?? 0;
  const last = sorted[sorted.length - 1]?.seconds ?? 0;
  const startBucket = Math.floor(first / bucketSec) * bucketSec;
  const bucketCount = Math.max(1, Math.ceil((last - startBucket + 1) / bucketSec));

  const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: clockOf(startBucket + i * bucketSec).replace(/:\d\d\s/, ' '),
    value: 0,
  }));
  sorted.forEach((sighting) => {
    const idx = Math.min(bucketCount - 1, Math.floor((sighting.seconds - startBucket) / bucketSec));
    buckets[idx].value += 1;
  });

  const cameraCounts = new Map<string, CameraFrequencyRow>();
  sorted.forEach((sighting) => {
    const row = cameraCounts.get(sighting.cameraId) ?? {
      cameraId: sighting.cameraId,
      location: sighting.location,
      city: sighting.city,
      reads: 0,
      primary: false,
    };
    row.reads += 1;
    row.primary = row.primary || Boolean(sighting.journeyStep);
    cameraCounts.set(sighting.cameraId, row);
  });

  const areaCounts = new Map<string, { label: string; city: string; count: number }>();
  sorted.forEach((sighting) => {
    const row = areaCounts.get(sighting.area) ?? { label: sighting.area, city: sighting.city, count: 0 };
    row.count += 1;
    areaCounts.set(sighting.area, row);
  });

  const areas = [...areaCounts.values()].sort((a, b) => b.count - a.count);
  const locations: LocationDistributionSlice[] = areas.map((area, i) => ({
    id: area.label,
    label: area.label,
    city: area.city,
    count: area.count,
    share: Number(((area.count / Math.max(1, sorted.length)) * 100).toFixed(1)),
    color: locationColors[i % locationColors.length],
  }));

  const cityTotals = [...new Set(sorted.map((s) => s.city))].map((city) => {
    const count = sorted.filter((s) => s.city === city).length;
    return { city, count, share: Number(((count / Math.max(1, sorted.length)) * 100).toFixed(1)) };
  });

  const peak = buckets.reduce((best, bucket) => (bucket.value > best.value ? bucket : best), buckets[0]);

  return {
    buckets,
    peak,
    cameraRows: [...cameraCounts.values()].sort((a, b) => b.reads - a.reads || collator.compare(a.cameraId, b.cameraId)),
    locations,
    cityTotals,
  };
}

/* ---------------- case bundle ---------------- */

export function nextCaseRef(existing: string | null): string {
  const seq = existing ? Number(existing.replace(/\D/g, '')) : 117;
  return `CR-${(seq || 117) + 1}/2026`;
}

export function caseBundle(
  dossierValue: InvestigationDossier,
  caseTitle: string,
  priority: string,
  notes: string,
  evidenceIds: string[],
): Record<string, unknown> {
  const analysis = computeRouteAnalysis(dossierValue.sightings);
  return {
    schema: 'gp.cctv.investigation.case/v1',
    exportedAt: new Date().toISOString(),
    investigationId: dossierValue.caseId,
    case: { title: caseTitle, priority, notes, unit: dossierValue.unit, officer: dossierValue.openedBy },
    target: {
      plate: dossierValue.target.plate,
      label: dossierValue.target.label,
      colour: dossierValue.target.color,
      registeredOwner: dossierValue.target.registeredOwner,
      watchlist: dossierValue.target.watchlist.category,
      confidence: dossierValue.target.confidence,
    },
    route: {
      durationSec: analysis.durationSec,
      camerasCrossed: analysis.camerasCrossed,
      distanceKm: analysis.distanceKm,
      corridor: analysis.corridorLabel,
      bearingDeg: analysis.bearingDeg,
    },
    sightings: dossierValue.sightings.map((s) => ({
      id: s.id,
      cameraId: s.cameraId,
      time: s.time,
      location: `${s.location}, ${s.city}`,
      confidence: s.confidence,
      direction: s.direction,
      speedKph: s.speedKph,
      lat: s.lat,
      lng: s.lng,
    })),
    events: dossierValue.events.map((e) => ({ id: e.alertId, title: e.title, camera: e.cameraId, time: e.time })),
    evidence: evidenceIds,
  };
}

/** Camera select options for the header + sighting filter. */
export function cameraOptionsOf(sightings: VehicleSighting[]): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  [...sightings]
    .sort((a, b) => a.seconds - b.seconds)
    .forEach((sighting) => {
      if (seen.has(sighting.cameraId)) return;
      seen.add(sighting.cameraId);
      out.push({ id: sighting.cameraId, label: `${sighting.cameraId} · ${sighting.location}` });
    });
  return out;
}

