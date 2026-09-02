/**
 * Vehicle Search workspace — mock data layer.
 *
 * Every selector returns pure, serialisable objects so the page can be
 * swapped onto ANPR / GIS / tracking / WebSocket services without a
 * structural rewrite. Gujarat Police operating areas (Ahmedabad,
 * Gandhinagar, Vadodara) and realistic plates (GJ01, GJ05, GJ18 …)
 * are used throughout.
 */

import camC001 from '@/assets/cam-c001.jpg';
import camC007 from '@/assets/cam-c007.jpg';
import camC015 from '@/assets/cam-c015.jpg';
import camC038 from '@/assets/cam-c038.jpg';
import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';

/* ------------------------------------------------------------------ *
 * Types (kept co-located for a single-file seam — move to types/ when
 * the second consumer lands)
 * ------------------------------------------------------------------ */

export type SearchType = 'plate' | 'partial' | 'type' | 'color';

export interface SearchFilters {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  camera: string;
  direction: string;
  vehicleType: string;
  color: string;
  watchlistStatus: string;
  minConfidence: number;
}

export interface Sighting {
  id: string;
  timestamp: string;
  seconds: number;
  cameraId: string;
  location: string;
  city: string;
  direction: string;
  vehicleType: string;
  confidence: number;
  matchStatus: 'Matched' | 'Confirmed' | 'Pending' | 'Unverified';
  snapshot: string;
  speedKph: number;
  lane: string;
}

export interface JourneyNode {
  step: number;
  cameraId: string;
  location: string;
  city: string;
  timestamp: string;
  seconds: number;
  thumbnail: string;
  isWatchlistAlert?: boolean;
}

export interface EvidenceFrame {
  id: string;
  cameraId: string;
  location: string;
  city: string;
  timestamp: string;
  snapshot: string;
  confidence: number;
}

export interface RelatedEventItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  cameraId: string;
  location: string;
  timestamp: string;
  detail: string;
  metric: string;
}

export interface TimeBucket {
  label: string;
  value: number;
}

export interface CameraDetection {
  cameraId: string;
  location: string;
  count: number;
}

export interface LocationRank {
  label: string;
  city: string;
  count: number;
}

export interface VehicleProfile {
  plate: string;
  watchlistMatch: boolean;
  watchlistCategory: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  color: string;
  fuel: string;
  registrationState: string;
  registeredOwner: string;
  confidence: number;
  totalSightings: number;
  firstSeen: string;
  lastSeen: string;
  status: 'Active Tracking' | 'Parked' | 'Lost' | 'Archived';
  currentCamera: string;
  currentLocation: string;
  currentCity: string;
  currentDirection: string;
  currentSpeed: number;
  detectionConfidence: number;
  latestEvent: string;
  snapshot: string;
}

export interface VehicleIntelligence {
  camera: string;
  location: string;
  city: string;
  direction: string;
  speed: number;
  confidence: number;
  watchlistCategory: string;
  latestEvent: string;
  status: 'on-road' | 'parked' | 'lost';
}

export interface MovementSummary {
  camerasCrossed: number;
  journeyDuration: string;
  estimatedDistance: string;
  avgTimeBetweenSightings: string;
}

/* ------------------------------------------------------------------ *
 * KPIs
 * ------------------------------------------------------------------ */

export const searchKpis = {
  totalMatches: 27,
  camerasDetected: 4,
  firstSeen: '10:21:15 AM',
  lastSeen: '10:44:03 AM',
  watchlistMatches: 1,
};

/* ------------------------------------------------------------------ *
 * Vehicle Profile (the resolved dossier)
 * ------------------------------------------------------------------ */

export const vehicleProfile: VehicleProfile = {
  plate: 'GJ01AB1234',
  watchlistMatch: true,
  watchlistCategory: 'High Priority Vehicles',
  vehicleType: 'Car · Sedan',
  make: 'Maruti',
  model: 'Swift Dzire',
  year: 2019,
  color: 'White',
  fuel: 'Petrol',
  registrationState: 'Gujarat (GJ-01 Ahmedabad)',
  registeredOwner: 'Arjun Rathod',
  confidence: 98.7,
  totalSightings: 4,
  firstSeen: '10:21:15 AM',
  lastSeen: '10:44:03 AM',
  status: 'Active Tracking',
  currentCamera: 'C-038',
  currentLocation: 'Gift City Road',
  currentCity: 'Gandhinagar',
  currentDirection: 'East',
  currentSpeed: 62,
  detectionConfidence: 98.7,
  latestEvent: 'Watchlist Match · GIFT City gantry',
  snapshot: vehicleSnapshot,
};

/* ------------------------------------------------------------------ *
 * Vehicle Journey (GIS route nodes)
 * ------------------------------------------------------------------ */

export const journeyNodes: JourneyNode[] = [
  {
    step: 1,
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    timestamp: '10:21:15 AM',
    seconds: 10 * 3600 + 21 * 60 + 15,
    thumbnail: camC001,
  },
  {
    step: 2,
    cameraId: 'C-007',
    location: 'Naranpura Road',
    city: 'Ahmedabad',
    timestamp: '10:28:42 AM',
    seconds: 10 * 3600 + 28 * 60 + 42,
    thumbnail: camC007,
  },
  {
    step: 3,
    cameraId: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    timestamp: '10:34:18 AM',
    seconds: 10 * 3600 + 34 * 60 + 18,
    thumbnail: camC015,
  },
  {
    step: 4,
    cameraId: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    timestamp: '10:44:03 AM',
    seconds: 10 * 3600 + 44 * 60 + 3,
    thumbnail: camC038,
    isWatchlistAlert: true,
  },
];

/* ------------------------------------------------------------------ *
 * Sightings (full history)
 * ------------------------------------------------------------------ */

export const sightings: Sighting[] = [
  {
    id: 'VS-1041',
    timestamp: '10:21:15 AM',
    seconds: 10 * 3600 + 21 * 60 + 15,
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    direction: 'West',
    vehicleType: 'Car · Sedan',
    confidence: 96.4,
    matchStatus: 'Confirmed',
    snapshot: camC001,
    speedKph: 48,
    lane: 'Lane 2 · slow',
  },
  {
    id: 'VS-1045',
    timestamp: '10:28:42 AM',
    seconds: 10 * 3600 + 28 * 60 + 42,
    cameraId: 'C-007',
    location: 'Naranpura Road',
    city: 'Ahmedabad',
    direction: 'North-West',
    vehicleType: 'Car · Sedan',
    confidence: 97.1,
    matchStatus: 'Confirmed',
    snapshot: camC007,
    speedKph: 52,
    lane: 'Lane 2 · slow',
  },
  {
    id: 'VS-1049',
    timestamp: '10:34:18 AM',
    seconds: 10 * 3600 + 34 * 60 + 18,
    cameraId: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    direction: 'North-East',
    vehicleType: 'Car · Sedan',
    confidence: 98.2,
    matchStatus: 'Matched',
    snapshot: camC015,
    speedKph: 74,
    lane: 'Lane 1 · fast',
  },
  {
    id: 'VS-1054',
    timestamp: '10:44:03 AM',
    seconds: 10 * 3600 + 44 * 60 + 3,
    cameraId: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    direction: 'East',
    vehicleType: 'Car · Sedan',
    confidence: 98.7,
    matchStatus: 'Matched',
    snapshot: camC038,
    speedKph: 62,
    lane: 'Lane 2 · slow',
  },
];

/* ------------------------------------------------------------------ *
 * Evidence Gallery
 * ------------------------------------------------------------------ */

export const evidenceFrames: EvidenceFrame[] = [
  {
    id: 'EV-1',
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    timestamp: '10:21:15 AM',
    snapshot: camC001,
    confidence: 96.4,
  },
  {
    id: 'EV-2',
    cameraId: 'C-007',
    location: 'Naranpura Road',
    city: 'Ahmedabad',
    timestamp: '10:28:42 AM',
    snapshot: camC007,
    confidence: 97.1,
  },
  {
    id: 'EV-3',
    cameraId: 'C-015',
    location: 'Kudasan Road',
    city: 'Gandhinagar',
    timestamp: '10:34:18 AM',
    snapshot: camC015,
    confidence: 98.2,
  },
  {
    id: 'EV-4',
    cameraId: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    timestamp: '10:44:03 AM',
    snapshot: camC038,
    confidence: 98.7,
  },
];

/* ------------------------------------------------------------------ *
 * Related Events
 * ------------------------------------------------------------------ */

export const relatedEvents: RelatedEventItem[] = [
  {
    id: 'RE-1',
    title: 'Watchlist Match',
    severity: 'critical',
    cameraId: 'C-038',
    location: 'Gift City Road',
    timestamp: '10:44:03 AM',
    detail: 'ANPR read matched WL-001 on the GIFT City gantry. High Priority Vehicles category.',
    metric: '98.7% OCR · 1.4s match',
  },
  {
    id: 'RE-2',
    title: 'Speed Violation',
    severity: 'high',
    cameraId: 'C-015',
    location: 'Kudasan Road',
    timestamp: '10:34:18 AM',
    detail: 'Average-speed enforcement flagged 74 km/h against a 60 km/h limit on the Kudasan corridor.',
    metric: '74 km/h vs 60 km/h (+23%)',
  },
  {
    id: 'RE-3',
    title: 'Wrong Direction',
    severity: 'medium',
    cameraId: 'C-007',
    location: 'Naranpura Road',
    timestamp: '10:29:30 AM',
    detail: 'Vehicle briefly tracked against declared flow for 8 seconds while overtaking a heavy vehicle.',
    metric: '8s against flow · Lane 2',
  },
  {
    id: 'RE-4',
    title: 'ANPR Plate Variance',
    severity: 'info',
    cameraId: 'C-001',
    location: 'Shahibaug Road',
    timestamp: '10:21:15 AM',
    detail: 'OCR returned 96.4% with 3.6% glyph variance. Confirmed after cross-camera read at C-007.',
    metric: 'OCR variance 3.6%',
  },
];

/* ------------------------------------------------------------------ *
 * Search Analytics
 * ------------------------------------------------------------------ */

export const matchesOverTime: TimeBucket[] = [
  { label: '10:20', value: 0 },
  { label: '10:22', value: 2 },
  { label: '10:24', value: 3 },
  { label: '10:26', value: 1 },
  { label: '10:28', value: 5 },
  { label: '10:30', value: 2 },
  { label: '10:32', value: 1 },
  { label: '10:34', value: 4 },
  { label: '10:36', value: 3 },
  { label: '10:38', value: 1 },
  { label: '10:40', value: 2 },
  { label: '10:42', value: 3 },
];

export const detectionsByCamera: CameraDetection[] = [
  { cameraId: 'C-001', location: 'Shahibaug Road', count: 8 },
  { cameraId: 'C-007', location: 'Naranpura Road', count: 7 },
  { cameraId: 'C-015', location: 'Kudasan Road', count: 6 },
  { cameraId: 'C-038', location: 'Gift City Road', count: 6 },
];

export const locationsVisited: LocationRank[] = [
  { label: 'Shahibaug Road', city: 'Ahmedabad', count: 8 },
  { label: 'Naranpura Road', city: 'Ahmedabad', count: 7 },
  { label: 'Kudasan Road', city: 'Gandhinagar', count: 6 },
  { label: 'Gift City Road', city: 'Gandhinagar', count: 6 },
];

export const movementSummary: MovementSummary = {
  camerasCrossed: 4,
  journeyDuration: '22 min 48 sec',
  estimatedDistance: '21.8 km',
  avgTimeBetweenSightings: '7 min 36 sec',
};

/* ------------------------------------------------------------------ *
 * Search type / advanced filter options
 * ------------------------------------------------------------------ */

export const searchTypeOptions: Array<{ id: SearchType; label: string }> = [
  { id: 'plate', label: 'Plate Number' },
  { id: 'partial', label: 'Partial Plate' },
  { id: 'type', label: 'Vehicle Type' },
  { id: 'color', label: 'Color' },
];

export const locationOptions = [
  { id: 'all', label: 'All Locations' },
  { id: 'Ahmedabad', label: 'Ahmedabad' },
  { id: 'Gandhinagar', label: 'Gandhinagar' },
  { id: 'Vadodara', label: 'Vadodara' },
  { id: 'Surat', label: 'Surat' },
  { id: 'Rajkot', label: 'Rajkot' },
];

export const cameraOptions = [
  { id: 'all', label: 'All Cameras' },
  { id: 'C-001', label: 'C-001 · Shahibaug Road' },
  { id: 'C-007', label: 'C-007 · Naranpura Road' },
  { id: 'C-015', label: 'C-015 · Kudasan Road' },
  { id: 'C-038', label: 'C-038 · Gift City Road' },
  { id: 'C-045', label: 'C-045 · Iskcon Circle' },
  { id: 'C-052', label: 'C-052 · Vastrapur Lake' },
  { id: 'C-089', label: 'C-089 · Maninagar' },
  { id: 'C-115', label: 'C-115 · S.G. Highway' },
];

export const directionOptions = [
  { id: 'all', label: 'All Directions' },
  { id: 'N', label: 'North' },
  { id: 'NE', label: 'North-East' },
  { id: 'E', label: 'East' },
  { id: 'SE', label: 'South-East' },
  { id: 'S', label: 'South' },
  { id: 'SW', label: 'South-West' },
  { id: 'W', label: 'West' },
  { id: 'NW', label: 'North-West' },
];

export const vehicleTypeOptions = [
  { id: 'all', label: 'All Types' },
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'hatchback', label: 'Hatchback' },
  { id: 'truck', label: 'Truck' },
  { id: 'bus', label: 'Bus' },
  { id: 'two-wheeler', label: 'Two-Wheeler' },
  { id: 'auto', label: 'Auto-Rickshaw' },
];

export const colorOptions = [
  { id: 'all', label: 'All Colors' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'silver', label: 'Silver' },
  { id: 'red', label: 'Red' },
  { id: 'blue', label: 'Blue' },
  { id: 'grey', label: 'Grey' },
  { id: 'green', label: 'Green' },
];

export const watchlistStatusOptions = [
  { id: 'all', label: 'All' },
  { id: 'watchlist', label: 'On Watchlist' },
  { id: 'clear', label: 'Clear' },
];

/* ------------------------------------------------------------------ *
 * Other known plates (for quick-search suggestions)
 * ------------------------------------------------------------------ */

export const knownPlates = [
  { plate: 'GJ01AB1234', sub: 'White Maruti Swift Dzire · 2019', tone: 'red' as const },
  { plate: 'GJ05JK6789', sub: 'Silver Hyundai Creta · 2020', tone: 'orange' as const },
  { plate: 'GJ18CD4521', sub: 'Black Mahindra Bolero · 2018', tone: 'purple' as const },
];

export const defaultFilters: SearchFilters = {
  dateFrom: '2026-09-01',
  dateTo: '2026-09-01',
  timeFrom: '',
  timeTo: '',
  location: 'all',
  camera: 'all',
  direction: 'all',
  vehicleType: 'all',
  color: 'all',
  watchlistStatus: 'all',
  minConfidence: 0,
};
