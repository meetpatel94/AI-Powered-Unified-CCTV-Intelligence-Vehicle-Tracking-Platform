import {
  BellRing,
  Car,
  CarFront,
  Layers,
  Package,
  ShieldAlert,
  Siren,
  Skull,
  Star,
  UserRound,
  UserSearch,
  UsersRound,
} from 'lucide-react';

import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';
import wlBikeRed from '@/assets/wl-bike-red.jpg';
import wlCarGrey from '@/assets/wl-car-grey.jpg';
import wlPerson1 from '@/assets/wl-person-1.jpg';
import wlPerson2 from '@/assets/wl-person-2.jpg';
import wlPerson3 from '@/assets/wl-person-3.jpg';
import wlSuvBlack from '@/assets/wl-suv-black.jpg';
import wlSuvWhite from '@/assets/wl-suv-white.jpg';
import wlTruckBlue from '@/assets/wl-truck-blue.jpg';

import type {
  AlertsByWatchlistBar,
  MatchesPoint,
  TopLocation,
  WatchlistAlertItem,
  WatchlistCategory,
  WatchlistEntry,
  WatchlistKpi,
  WatchlistSummarySlice,
} from '@/types/watchlist';

/* ------------------------------------------------------------------ *
 * KPI strip
 * ------------------------------------------------------------------ */

export const watchlistKpis: WatchlistKpi[] = [
  { id: 'total', label: 'Total Watchlist Entries', value: '248', footnote: '7 categories · 12 added this week', tone: 'blue', icon: Layers },
  { id: 'alerts', label: 'Active Alerts', value: '18', footnote: '3 critical need action', tone: 'red', icon: BellRing },
  { id: 'vehicles', label: 'Vehicles', value: '186', footnote: '75% of all entries', tone: 'green', icon: CarFront },
  { id: 'persons', label: 'Persons', value: '42', footnote: '17% of all entries', tone: 'purple', icon: UsersRound },
  { id: 'other', label: 'Other Entities', value: '20', footnote: '8% of all entries', tone: 'orange', icon: Package },
];

/* ------------------------------------------------------------------ *
 * Categories (left column table)
 * ------------------------------------------------------------------ */

export const watchlistCategories: WatchlistCategory[] = [
  { id: 'high-priority', name: 'High Priority Vehicles', type: 'vehicle', entries: 34, activeAlerts: 6, updated: '12m ago', tone: 'red', icon: Siren },
  { id: 'stolen', name: 'Stolen Vehicles', type: 'vehicle', entries: 62, activeAlerts: 5, updated: '26m ago', tone: 'orange', icon: Car },
  { id: 'wanted', name: 'Wanted Persons', type: 'person', entries: 26, activeAlerts: 3, updated: '1h ago', tone: 'purple', icon: UserSearch },
  { id: 'known', name: 'Known Criminals', type: 'person', entries: 16, activeAlerts: 2, updated: '2h ago', tone: 'red', icon: Skull },
  { id: 'suspect', name: 'Suspect Vehicles', type: 'vehicle', entries: 90, activeAlerts: 1, updated: '3h ago', tone: 'blue', icon: CarFront },
  { id: 'vip', name: 'VIP / Sensitive', type: 'other', entries: 12, activeAlerts: 1, updated: 'Yesterday', tone: 'green', icon: Star },
  { id: 'others', name: 'Others', type: 'other', entries: 8, activeAlerts: 0, updated: '2d ago', tone: 'cyan', icon: Package },
];

/* ------------------------------------------------------------------ *
 * Entries (center grid)
 * ------------------------------------------------------------------ */

export const watchlistEntries: WatchlistEntry[] = [
  {
    id: 'wl-001',
    type: 'vehicle',
    label: 'GJ01AB1234',
    details: 'White Maruti Swift Dzire · 2019',
    categoryId: 'high-priority',
    status: 'active',
    priority: 'critical',
    addedOn: '02 Mar 2026',
    addedTs: 20260302,
    lastMatchTs: 99,
    addedBy: 'Insp. Rajveer',
    matches: 27,
    thumbnail: vehicleSnapshot,
    notes:
      'Repeat offender vehicle linked to three ATM-skimming cases across Ahmedabad. Intercept and inform SO Crime on positive match.',
    matchingCameras: ['C-038', 'C-001', 'C-115', 'C-089'],
    latestMatch: { time: '10:44:03 AM', ago: '2 min ago', camera: 'C-038', location: 'Gift City Road, Gandhinagar', confidence: 97 },
    history: [
      { time: '10:44:03 AM', ago: '2 min ago', camera: 'C-038', location: 'Gift City Road, Gandhinagar', confidence: 97 },
      { time: '09:12:44 AM', ago: '1.5 hr ago', camera: 'C-001', location: 'Shahibaug Road, Ahmedabad', confidence: 94 },
      { time: '08:41:19 PM', ago: 'Yesterday', camera: 'C-115', location: 'S.G. Highway, Ahmedabad', confidence: 91 },
      { time: '06:03:52 PM', ago: 'Yesterday', camera: 'C-089', location: 'Maninagar, Ahmedabad', confidence: 88 },
    ],
  },
  {
    id: 'wl-002',
    type: 'vehicle',
    label: 'GJ05JK6789',
    details: 'Black Hyundai Creta · 2021',
    categoryId: 'stolen',
    status: 'active',
    priority: 'high',
    addedOn: '18 Jun 2026',
    addedTs: 20260618,
    lastMatchTs: 98,
    addedBy: 'PSI D. Rathod',
    matches: 14,
    thumbnail: wlSuvBlack,
    notes: 'Reported stolen from Satellite on 17 Jun 2026 (FIR 114/2026). Owner: N. Mehta. May carry duplicate plates.',
    matchingCameras: ['C-115', 'C-045', 'C-131'],
    latestMatch: { time: '10:42:11 AM', ago: '4 min ago', camera: 'C-115', location: 'S.G. Highway, Ahmedabad', confidence: 92 },
    history: [
      { time: '10:42:11 AM', ago: '4 min ago', camera: 'C-115', location: 'S.G. Highway, Ahmedabad', confidence: 92 },
      { time: '07:55:31 AM', ago: '3 hr ago', camera: 'C-045', location: 'Railway Station, Ahmedabad', confidence: 90 },
      { time: '09:26:08 PM', ago: 'Yesterday', camera: 'C-131', location: 'Ring Road, Surat', confidence: 85 },
    ],
  },
  {
    id: 'wl-003',
    type: 'vehicle',
    label: 'GJ18CD4521',
    details: 'Red Bajaj Pulsar 220 · 2018',
    categoryId: 'suspect',
    status: 'monitoring',
    priority: 'medium',
    addedOn: '05 Jul 2026',
    addedTs: 20260705,
    lastMatchTs: 97,
    addedBy: 'PSI D. Rathod',
    matches: 6,
    thumbnail: wlBikeRed,
    notes: 'Seen circling bank branches in Vadodara on two consecutive Saturdays. Rider wears dark helmet, no visor sticker.',
    matchingCameras: ['C-207', 'C-160'],
    latestMatch: { time: '10:38:55 AM', ago: '7 min ago', camera: 'C-207', location: 'Vadodara City Center', confidence: 88 },
    history: [
      { time: '10:38:55 AM', ago: '7 min ago', camera: 'C-207', location: 'Vadodara City Center', confidence: 88 },
      { time: '11:02:17 AM', ago: 'Sat', camera: 'C-160', location: 'Alkapuri, Vadodara', confidence: 82 },
    ],
  },
  {
    id: 'wl-004',
    type: 'person',
    label: 'Arjun Rathod',
    alias: 'Kala Arjun',
    details: 'Male · 34 yrs · 5′9″ · checked shirt',
    categoryId: 'wanted',
    status: 'active',
    priority: 'critical',
    addedOn: '11 Jan 2026',
    addedTs: 20260111,
    lastMatchTs: 96,
    addedBy: 'SO Crime',
    matches: 11,
    thumbnail: wlPerson1,
    notes: 'Wanted in chain-snatching racket (NC 22/2026). Frequents Maninagar market evenings. Considered armed — do not approach solo.',
    matchingCameras: ['C-089', 'C-052', 'C-007'],
    latestMatch: { time: '10:31:47 AM', ago: '14 min ago', camera: 'C-089', location: 'Maninagar, Ahmedabad', confidence: 91 },
    history: [
      { time: '10:31:47 AM', ago: '14 min ago', camera: 'C-089', location: 'Maninagar, Ahmedabad', confidence: 91 },
      { time: '06:48:22 PM', ago: 'Yesterday', camera: 'C-052', location: 'Kankaria Lakefront', confidence: 87 },
      { time: '05:37:09 PM', ago: '2d ago', camera: 'C-007', location: 'Naranpura, Ahmedabad', confidence: 84 },
    ],
  },
  {
    id: 'wl-005',
    type: 'person',
    label: 'Vikram Solanki',
    alias: 'Vicky',
    details: 'Male · 41 yrs · beard · black jacket',
    categoryId: 'known',
    status: 'active',
    priority: 'high',
    addedOn: '23 Feb 2026',
    addedTs: 20260223,
    lastMatchTs: 95,
    addedBy: 'Insp. Rajveer',
    matches: 9,
    thumbnail: wlPerson2,
    notes: 'History of railway platform thefts. Banned from Ahmedabad junction premises under S.144 order.',
    matchingCameras: ['C-045', 'C-015'],
    latestMatch: { time: '10:12:03 AM', ago: '34 min ago', camera: 'C-045', location: 'Railway Station, Ahmedabad', confidence: 89 },
    history: [
      { time: '10:12:03 AM', ago: '34 min ago', camera: 'C-045', location: 'Railway Station, Ahmedabad', confidence: 89 },
      { time: '09:03:41 AM', ago: '2d ago', camera: 'C-015', location: 'Kudasan Road, Gandhinagar', confidence: 81 },
    ],
  },
  {
    id: 'wl-006',
    type: 'vehicle',
    label: 'GJ12EF8890',
    details: 'Blue Tata Ace · 2020',
    categoryId: 'stolen',
    status: 'active',
    priority: 'high',
    addedOn: '30 May 2026',
    addedTs: 20260530,
    lastMatchTs: 94,
    addedBy: 'PSI K. Chauhan',
    matches: 8,
    thumbnail: wlTruckBlue,
    notes: 'Stolen goods carrier, last seen loaded with cattle-feed sacks. FIR 087/2026, Naroda PS.',
    matchingCameras: ['C-131', 'C-115'],
    latestMatch: { time: '09:47:26 AM', ago: '58 min ago', camera: 'C-131', location: 'Ring Road, Surat', confidence: 90 },
    history: [
      { time: '09:47:26 AM', ago: '58 min ago', camera: 'C-131', location: 'Ring Road, Surat', confidence: 90 },
      { time: '04:19:55 PM', ago: '3d ago', camera: 'C-115', location: 'S.G. Highway, Ahmedabad', confidence: 86 },
    ],
  },
  {
    id: 'wl-007',
    type: 'vehicle',
    label: 'GJ03XY4477',
    details: 'Grey Maruti Baleno · 2022',
    categoryId: 'suspect',
    status: 'monitoring',
    priority: 'medium',
    addedOn: '14 Jul 2026',
    addedTs: 20260714,
    lastMatchTs: 93,
    addedBy: 'PSI K. Chauhan',
    matches: 4,
    thumbnail: wlCarGrey,
    notes: 'Flagged by patrol for erratic night driving near CG Road. Under observation for two more weeks.',
    matchingCameras: ['C-160', 'C-001'],
    latestMatch: { time: '09:21:54 AM', ago: '1.4 hr ago', camera: 'C-160', location: 'Alkapuri, Vadodara', confidence: 84 },
    history: [
      { time: '09:21:54 AM', ago: '1.4 hr ago', camera: 'C-160', location: 'Alkapuri, Vadodara', confidence: 84 },
      { time: '11:44:12 PM', ago: '4d ago', camera: 'C-001', location: 'CG Road, Ahmedabad', confidence: 79 },
    ],
  },
  {
    id: 'wl-008',
    type: 'person',
    label: 'Mukesh Chauhan',
    alias: 'Muku',
    details: 'Male · 29 yrs · red t-shirt · cap',
    categoryId: 'wanted',
    status: 'active',
    priority: 'medium',
    addedOn: '09 Aug 2026',
    addedTs: 20260809,
    lastMatchTs: 92,
    addedBy: 'SO Crime',
    matches: 3,
    thumbnail: wlPerson3,
    notes: 'Suspected pickpocket operating in crowded markets. Verify against 24 Aug complaint at Dani Limda PS.',
    matchingCameras: ['C-052', 'C-089'],
    latestMatch: { time: '08:56:12 AM', ago: '1.9 hr ago', camera: 'C-052', location: 'Kankaria Lakefront', confidence: 86 },
    history: [
      { time: '08:56:12 AM', ago: '1.9 hr ago', camera: 'C-052', location: 'Kankaria Lakefront', confidence: 86 },
      { time: '05:22:38 PM', ago: '5d ago', camera: 'C-089', location: 'Maninagar, Ahmedabad', confidence: 80 },
    ],
  },
  {
    id: 'wl-009',
    type: 'other',
    label: 'GJ09ZV0007',
    details: 'White Toyota Fortuner · VIP escort',
    categoryId: 'vip',
    status: 'active',
    priority: 'low',
    addedOn: '01 Apr 2026',
    addedTs: 20260401,
    lastMatchTs: 91,
    addedBy: 'SP Security',
    matches: 5,
    thumbnail: wlSuvWhite,
    notes: 'Escort vehicle for Z-category protectee. Passive watch — log movements only, no alerts to field units.',
    matchingCameras: ['C-001', 'C-015'],
    latestMatch: { time: '09:58:41 AM', ago: '48 min ago', camera: 'C-001', location: 'Shahibaug Road, Ahmedabad', confidence: 95 },
    history: [
      { time: '09:58:41 AM', ago: '48 min ago', camera: 'C-001', location: 'Shahibaug Road, Ahmedabad', confidence: 95 },
      { time: '08:14:05 AM', ago: 'Yesterday', camera: 'C-015', location: 'Kudasan Road, Gandhinagar', confidence: 93 },
    ],
  },
];

/** Lookup helper shared by the entry grid, list rows and the drawer. */
export function categoryOf(entry: WatchlistEntry) {
  return watchlistCategories.find((category) => category.id === entry.categoryId);
}

/* ------------------------------------------------------------------ *
 * Right rail: alerts + summary donut
 * ------------------------------------------------------------------ */

export const watchlistAlerts: WatchlistAlertItem[] = [
  { id: 'wa1', title: 'Watchlist Match', label: 'GJ01AB1234', camera: 'C-038', location: 'Gift City Road', time: '10:44:03 AM', ago: '2 min ago', severity: 'critical', icon: ShieldAlert },
  { id: 'wa2', title: 'Stolen Vehicle Sighted', label: 'GJ05JK6789', camera: 'C-115', location: 'S.G. Highway', time: '10:42:11 AM', ago: '4 min ago', severity: 'high', icon: Car },
  { id: 'wa3', title: 'Suspect Vehicle', label: 'GJ18CD4521', camera: 'C-207', location: 'Vadodara City', time: '10:38:55 AM', ago: '7 min ago', severity: 'medium', icon: CarFront },
  { id: 'wa4', title: 'Wanted Person Match', label: 'Arjun Rathod', camera: 'C-089', location: 'Maninagar', time: '10:31:47 AM', ago: '14 min ago', severity: 'critical', icon: UserRound },
  { id: 'wa5', title: 'Known Criminal', label: 'Vikram Solanki', camera: 'C-045', location: 'Railway Station', time: '10:12:03 AM', ago: '34 min ago', severity: 'high', icon: Skull },
  { id: 'wa6', title: 'VIP Movement Logged', label: 'GJ09ZV0007', camera: 'C-001', location: 'Shahibaug Road', time: '09:58:41 AM', ago: '48 min ago', severity: 'info', icon: Star },
];

export const watchlistSummary: WatchlistSummarySlice[] = [
  { id: 'vehicles', label: 'Vehicles', count: 186, percent: 75, color: '#2f7dff' },
  { id: 'persons', label: 'Persons', count: 42, percent: 17, color: '#a855f7' },
  { id: 'others', label: 'Others', count: 20, percent: 8, color: '#22d3ee' },
];

/* ------------------------------------------------------------------ *
 * Bottom row: bars / line / locations
 * ------------------------------------------------------------------ */

export const alertsByWatchlist: AlertsByWatchlistBar[] = [
  { id: 'high-priority', label: 'High Pri.', value: 6, color: '#ef4444' },
  { id: 'stolen', label: 'Stolen', value: 5, color: '#f59e0b' },
  { id: 'wanted', label: 'Wanted', value: 3, color: '#a855f7' },
  { id: 'known', label: 'Known', value: 2, color: '#f87171' },
  { id: 'suspect', label: 'Suspect', value: 1, color: '#2f7dff' },
  { id: 'vip', label: 'VIP', value: 1, color: '#22c55e' },
  { id: 'others', label: 'Others', value: 0, color: '#22d3ee' },
];

export const matchesOverTime: MatchesPoint[] = [
  { day: '18', value: 3 },
  { day: '19', value: 5 },
  { day: '20', value: 4 },
  { day: '21', value: 7 },
  { day: '22', value: 6 },
  { day: '23', value: 9 },
  { day: '24', value: 8 },
  { day: '25', value: 6 },
  { day: '26', value: 10 },
  { day: '27', value: 12 },
  { day: '28', value: 9 },
  { day: '29', value: 13 },
  { day: '30', value: 15 },
  { day: '31', value: 18 },
];

export const topLocations: TopLocation[] = [
  { id: 't1', rank: 1, name: 'S.G. Highway', city: 'Ahmedabad', matches: 46, trend: 'up' },
  { id: 't2', rank: 2, name: 'Gift City Road', city: 'Gandhinagar', matches: 38, trend: 'up' },
  { id: 't3', rank: 3, name: 'City Center', city: 'Vadodara', matches: 29, trend: 'flat' },
  { id: 't4', rank: 4, name: 'Ring Road', city: 'Surat', matches: 21, trend: 'up' },
  { id: 't5', rank: 5, name: 'Maninagar', city: 'Ahmedabad', matches: 14, trend: 'down' },
  { id: 't6', rank: 6, name: 'CG Road', city: 'Ahmedabad', matches: 9, trend: 'down' },
];
