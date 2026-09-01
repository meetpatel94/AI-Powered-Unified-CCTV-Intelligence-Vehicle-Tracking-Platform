import type { LucideIcon } from 'lucide-react';

import type { Severity } from '@/types';

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** What the operator is searching for in the investigation console. */
export type SearchMode = 'vehicle' | 'camera' | 'person';

/** Lifecycle of an open investigation workspace. */
export type InvestigationStatus = 'active' | 'monitoring' | 'escalated' | 'closed';

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export type EventTone = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'cyan';

export type SightingSortKey = 'time' | 'camera' | 'location' | 'confidence' | 'type' | 'direction';

export type SightingSortDir = 'asc' | 'desc';

/** How a candidate was associated with the target vehicle. */
export type AssociationKind = 'convoy' | 'same-camera' | 'time-correlated' | 'registered-owner' | 'frequent-companion';

/* ------------------------------------------------------------------ *
 * Target + sightings
 * ------------------------------------------------------------------ */

export interface WatchlistContext {
  match: boolean;
  /** Watchlist book the plate sits in, e.g. "High Priority Vehicles". */
  category: string;
  categoryId: string;
  priority: CasePriority;
  entryId: string;
  addedOn: string;
  /** Free-text instruction the console shows next to a positive match. */
  action: string;
}

export interface InvestigationTarget {
  id: string;
  plate: string;
  make: string;
  model: string;
  variant: string;
  /** Display line used across the console, e.g. "White Swift Dzire". */
  label: string;
  color: string;
  year: number;
  vehicleClass: string;
  fuel: string;
  registeredOwner: string;
  registrationState: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
  snapshot: string;
  confidence: number;
  /** Mean ANPR confidence across the whole sighting set. */
  meanConfidence: number;
  status: 'on-road' | 'parked' | 'lost';
  watchlist: WatchlistContext;
  /** AI attributes extracted from the frames (make / colour / class agreement). */
  attributes: Array<{ label: string; value: string; confidence: number }>;
  /** Prior police history surfaced by the registry pull. */
  history: Array<{ label: string; detail: string; tone: EventTone }>;
}

/** One ANPR / AI read of the target on one camera. */
export interface VehicleSighting {
  id: string;
  cameraId: string;
  /** Seconds after midnight — the sort / duration key for the whole module. */
  seconds: number;
  time: string;
  location: string;
  area: string;
  city: string;
  zone: string;
  department: string;
  confidence: number;
  vehicleType: string;
  make: string;
  direction: string;
  lane: string;
  speedKph: number;
  /** Distance from the previous *primary* route node in km (0 on the first node). */
  legKm: number;
  /** Set on the ANPR-confirmed primary route nodes (1..n). */
  journeyStep?: number;
  watchlistHit?: boolean;
  /** Re-read of the same pass at the same camera (ANPR second frame). */
  reRead?: boolean;
  thumbnail: string;
  /** Extra archived frames for the evidence viewer. */
  frames: string[];
  clip: string;
  note?: string;
  /** World coordinates for the mini-map + lat/lng placeholders for real GIS. */
  x: number;
  y: number;
  lat: number;
  lng: number;
}

/* ------------------------------------------------------------------ *
 * Journey / route analytics
 * ------------------------------------------------------------------ */

export interface RouteLeg {
  index: number;
  from: VehicleSighting;
  to: VehicleSighting;
  seconds: number;
  label: string;
  km: number;
  speedKph: number;
  /** Points the polyline should follow, in world coordinates. */
  points: Array<[number, number]>;
  critical: boolean;
}

export interface RouteAnalysis {
  durationSec: number;
  durationLabel: string;
  camerasCrossed: number;
  primaryNodes: number;
  distanceKm: number;
  avgGapSec: number;
  avgGapLabel: string;
  avgSpeedKph: number;
  topSpeedKph: number;
  bearingDeg: number;
  compass: string;
  corridorLabel: string;
  cities: string[];
  zones: number;
  departments: string[];
  longestGap: { label: string; seconds: number };
  /** True when the last sighting is the current location (no movement since). */
  stationary: boolean;
}

export interface TimeBucket {
  label: string;
  value: number;
}

export interface CameraFrequencyRow {
  cameraId: string;
  location: string;
  city: string;
  reads: number;
  primary: boolean;
}

export interface LocationDistributionSlice {
  id: string;
  label: string;
  city: string;
  count: number;
  share: number;
  color: string;
}

export interface InvestigationAnalytics {
  buckets: TimeBucket[];
  peak: TimeBucket;
  cameraRows: CameraFrequencyRow[];
  locations: LocationDistributionSlice[];
  cityTotals: Array<{ city: string; count: number; share: number }>;
}

/* ------------------------------------------------------------------ *
 * Related intelligence
 * ------------------------------------------------------------------ */

export interface RelatedEvent {
  id: string;
  title: string;
  severity: Severity;
  tone: EventTone;
  cameraId: string;
  location: string;
  city: string;
  time: string;
  seconds: number;
  confidence: number;
  detail: string;
  metric?: string;
  alertId: string;
  sightingId: string;
  thumbnail: string;
  icon: LucideIcon;
  acknowledged: boolean;
}

export interface Association {
  id: string;
  kind: AssociationKind;
  kindLabel: string;
  label: string;
  sub: string;
  detail: string;
  /** Shared-camera count / correlation strength. */
  score: number;
  tone: EventTone;
  watchlist: boolean;
  thumbnail: string;
  sightings: string[];
  icon: LucideIcon;
  /** Deep link into the investigation console for that entity. */
  targetId?: string;
}

/* ------------------------------------------------------------------ *
 * Evidence + case file
 * ------------------------------------------------------------------ */

export interface EvidenceItem {
  id: string;
  sightingId: string;
  cameraId: string;
  location: string;
  city: string;
  time: string;
  seconds: number;
  confidence: number;
  thumbnail: string;
  clip: string;
  primary: boolean;
  watchlistHit: boolean;
  tags: string[];
}

export interface InvestigationCase {
  caseRef: string;
  title: string;
  priority: CasePriority;
  offence: string;
  fir: string;
  unit: string;
  officer: string;
  notes: string;
  evidenceIds: string[];
  createdAt: string;
}

/** Body of `POST /investigations/:plate/case` (see `services/api.ts`). */
export interface NewCasePayload {
  investigationId: string;
  title: string;
  priority: CasePriority;
  offence: string;
  fir: string;
  unit: string;
  officer: string;
  notes: string;
  evidenceIds: string[];
}

/** One entry in the "recent investigations" chip row. */
export interface RecentInvestigation {
  id: string;
  label: string;
  sub: string;
  ago: string;
  tone: EventTone;
  /** Target that chip re-opens. */
  targetId: string;
}

/** A candidate returned by the investigation search index. */
export interface SearchCandidate {
  id: string;
  kind: SearchMode;
  label: string;
  sub: string;
  meta: string;
  tone: EventTone;
  /** Target dossier this candidate resolves to. */
  targetId: string;
  icon: LucideIcon;
}

/** Everything the workspace needs to render one investigation. */
export interface InvestigationDossier {
  caseId: string;
  title: string;
  openedBy: string;
  openedAt: string;
  unit: string;
  status: InvestigationStatus;
  priority: CasePriority;
  target: InvestigationTarget;
  sightings: VehicleSighting[];
  events: RelatedEvent[];
  associations: Association[];
}

/** Sighting-history filter state (table selects + search). */
export interface SightingQuery {
  camera: string;
  city: string;
  minConfidence: number;
  primaryOnly: boolean;
  query: string;
}

/** Filters driving the whole console (mirrors a future `GET /investigations/:id`). */
export interface InvestigationFilters {
  date: string;
  range: string;
  location: string;
  camera: string;
}
