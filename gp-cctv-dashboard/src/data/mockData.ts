import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  Car,
  FileText,
  Gauge,
  LayoutDashboard,
  Map,
  Search,
  Settings,
  ShieldAlert,
  Siren,
  Users,
  UsersRound,
  Video,
} from 'lucide-react';

import camC001 from '@/assets/cam-c001.jpg';
import camC007 from '@/assets/cam-c007.jpg';
import camC015 from '@/assets/cam-c015.jpg';
import camC038 from '@/assets/cam-c038.jpg';
import camC115 from '@/assets/cam-c115.jpg';
import camC207 from '@/assets/cam-c207.jpg';
import vehicleSnapshot from '@/assets/vehicle-suspect.jpg';

import type {
  AlertItem,
  AnalyticsBar,
  CameraFeed,
  HealthSlice,
  JourneyStop,
  KpiStat,
  NavItem,
  SystemStatusItem,
  VehicleRecord,
} from '@/types';

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', available: true },
  { id: 'live-view', label: 'Live View', icon: Video, path: '/live-view', available: true },
  { id: 'camera-map', label: 'Camera Map', icon: Map, path: '/camera-map', available: true },
  { id: 'vehicle-search', label: 'Vehicle Search', icon: Search, path: '/vehicle-search' },
  { id: 'watchlist', label: 'Watchlist', icon: ShieldAlert, path: '/watchlist', available: true },
  { id: 'alerts', label: 'Alerts', icon: Bell, badge: 12, path: '/alerts' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'investigation', label: 'Investigation', icon: Siren, path: '/investigation' },
  { id: 'camera-health', label: 'Camera Health', icon: Gauge, path: '/camera-health' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { id: 'users-roles', label: 'Users & Roles', icon: Users, path: '/users-roles' },
  { id: 'system-settings', label: 'System Settings', icon: Settings, path: '/system-settings' },
];

export const systemStatus: SystemStatusItem[] = [
  { label: 'All Systems', value: 'Operational', state: 'operational' },
  { label: 'AI Engine', value: 'Operational', state: 'operational' },
  { label: 'Storage', value: 'Operational', state: 'operational' },
  { label: 'Network', value: 'Good', state: 'good' },
];

export const currentUser = {
  name: 'Inspector Rajveer',
  unit: 'Gandhinagar Command',
  notifications: 12,
};

/* ------------------------------------------------------------------ *
 * KPI row
 * ------------------------------------------------------------------ */

export const kpiStats: KpiStat[] = [
  {
    id: 'cameras',
    label: 'Total Cameras',
    value: '12,842',
    footnote: 'Online: 11,243 (87%)',
    tone: 'blue',
    icon: Camera,
  },
  {
    id: 'vehicles',
    label: 'Vehicles Detected',
    labelSuffix: '(Today)',
    value: '18,729',
    footnote: '12.5% from yesterday',
    trend: 'up',
    tone: 'green',
    icon: Car,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    labelSuffix: '(Today)',
    value: '23',
    footnote: '8 from yesterday',
    trend: 'up',
    tone: 'orange',
    icon: Bell,
  },
  {
    id: 'watchlist',
    label: 'Watchlist Matches',
    value: '7',
    footnote: 'Active Alerts',
    tone: 'red',
    icon: ShieldAlert,
  },
  {
    id: 'users',
    label: 'Active Users',
    value: '56',
    footnote: 'Online',
    tone: 'purple',
    icon: UsersRound,
  },
];

/* ------------------------------------------------------------------ *
 * Live CCTV feeds
 * ------------------------------------------------------------------ */

export const liveFeeds: CameraFeed[] = [
  {
    id: 'c-001',
    code: 'C-001',
    location: 'Shahibaug Road',
    city: 'Ahmedabad',
    thumbnail: camC001,
    status: 'live',
    streamUrl: 'rtsp://gp-edge-01.gujpolice.local/stream/c-001',
  },
  {
    id: 'c-038',
    code: 'C-038',
    location: 'Gift City Road',
    city: 'Gandhinagar',
    thumbnail: camC038,
    status: 'live',
    streamUrl: 'rtsp://gp-edge-04.gujpolice.local/stream/c-038',
  },
  {
    id: 'c-115',
    code: 'C-115',
    location: 'S.G. Highway',
    city: 'Ahmedabad',
    thumbnail: camC115,
    status: 'live',
    streamUrl: 'rtsp://gp-edge-02.gujpolice.local/stream/c-115',
  },
  {
    id: 'c-207',
    code: 'C-207',
    location: 'Vadodara City Center',
    city: '',
    thumbnail: camC207,
    status: 'live',
    streamUrl: 'rtsp://gp-edge-09.gujpolice.local/stream/c-207',
  },
];

/* ------------------------------------------------------------------ *
 * Recent alerts
 * ------------------------------------------------------------------ */

export const recentAlerts: AlertItem[] = [
  {
    id: 'a1',
    type: 'Watchlist Match',
    plate: 'GJ01AB1234',
    cameraCode: 'C-038',
    location: 'Gift City Road',
    time: '10:44:03 AM',
    ago: '2 min ago',
    severity: 'critical',
    icon: ShieldAlert,
  },
  {
    id: 'a2',
    type: 'Speed Violation',
    plate: 'GJ05JK6789',
    cameraCode: 'C-115',
    location: 'S.G. Highway',
    time: '10:42:11 AM',
    ago: '4 min ago',
    severity: 'high',
    icon: Gauge,
  },
  {
    id: 'a3',
    type: 'Wrong Direction',
    plate: 'GJ18CD4521',
    cameraCode: 'C-207',
    location: 'Vadodara City',
    time: '10:38:55 AM',
    ago: '7 min ago',
    severity: 'medium',
    icon: AlertTriangle,
  },
  {
    id: 'a4',
    type: 'Crowd Detected',
    cameraCode: 'C-089',
    location: 'Maninagar',
    time: '10:35:20 AM',
    ago: '10 min ago',
    severity: 'info',
    icon: UsersRound,
  },
];

/* ------------------------------------------------------------------ *
 * Camera health
 * ------------------------------------------------------------------ */

export const cameraHealth: HealthSlice[] = [
  { id: 'online', label: 'Online', count: 11243, percent: 87, color: '#22c55e' },
  { id: 'offline', label: 'Offline', count: 1128, percent: 9, color: '#ef4444' },
  { id: 'poor', label: 'Poor Signal', count: 471, percent: 4, color: '#f59e0b' },
];

/* ------------------------------------------------------------------ *
 * Vehicle of interest + journey
 * ------------------------------------------------------------------ */

export const trackedVehicle: VehicleRecord = {
  plate: 'GJ01AB1234',
  type: 'White Swift Dzire',
  color: 'White',
  firstSeen: '10:21:15 AM',
  lastSeen: '10:44:03 AM',
  snapshot: vehicleSnapshot,
  watchlistMatch: true,
};

export const journeyStops: JourneyStop[] = [
  {
    step: 1,
    time: '10:21:15 AM',
    cameraCode: 'C-001',
    road: 'Shahibaug Road',
    city: 'Ahmedabad',
    thumbnail: camC001,
  },
  {
    step: 2,
    time: '10:28:42 AM',
    cameraCode: 'C-007',
    road: 'Naranpura Road',
    city: 'Ahmedabad',
    thumbnail: camC007,
  },
  {
    step: 3,
    time: '10:34:18 AM',
    cameraCode: 'C-015',
    road: 'Kudasan Road',
    city: 'Gandhinagar',
    thumbnail: camC015,
  },
  {
    step: 4,
    time: '10:44:03 AM',
    cameraCode: 'C-038',
    road: 'Gift City Road',
    city: 'Gandhinagar',
    thumbnail: camC038,
    alert: true,
  },
];

/* ------------------------------------------------------------------ *
 * AI analytics
 * ------------------------------------------------------------------ */

export const analyticsBars: AnalyticsBar[] = [
  { id: 'vehicles', label: 'Vehicle Count', value: 18729, color: '#3b82f6', glow: 'rgba(59,130,246,0.45)' },
  { id: 'two-wheeler', label: 'Two Wheeler', value: 9642, color: '#22c55e', glow: 'rgba(34,197,94,0.45)' },
  { id: 'heavy', label: 'Heavy Vehicle', value: 2153, color: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
  { id: 'pedestrians', label: 'Pedestrians', value: 6892, color: '#a855f7', glow: 'rgba(168,85,247,0.45)' },
];

/* ------------------------------------------------------------------ *
 * Live map alert popup
 * ------------------------------------------------------------------ */

export const mapAlert = {
  title: 'ALERT: Watchlist Match',
  vehicle: 'GJ01AB1234',
  camera: 'C-038',
  location: 'Gift City Road',
  time: '10:44:03 AM',
};
