import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  Download,
  Eye,
  Filter,
  Gauge,
  Image,
  MapPin,
  MapPinned,
  Navigation,
  Plus,
  Radar,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Timer,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

import { Panel } from '@/components/common/Panel';
import {
  cameraOptions,
  colorOptions,
  defaultFilters,
  detectionsByCamera,
  directionOptions,
  evidenceFrames,
  journeyNodes,
  knownPlates,
  locationOptions,
  locationsVisited,
  matchesOverTime,
  movementSummary,
  relatedEvents,
  searchTypeOptions,
  sightings,
  vehicleProfile,
  vehicleTypeOptions,
  watchlistStatusOptions,
  type SearchFilters,
  type SearchType,
  type Sighting,
} from '@/data/vehicleSearchData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useVehicleSearch } from '@/hooks/useVehicleSearch';

/* ================================================================== *
 * Vehicle Search — VEHICLE INTELLIGENCE & SEARCH workspace
 *
 * Gujarat Police command-center page: prominent search + advanced
 * filters, KPI strip, vehicle profile / journey / intelligence panels,
 * sighting history table, evidence gallery, related events and search
 * analytics. Dark navy panels, thin blue-gray borders, cyan/blue route
 * styling, green/amber/red/purple semantic tones, Lucide icons and
 * subtle professional animations.
 * ================================================================== */

export function VehicleSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clock = formatClock(useLiveClock());

  /* ---------------- search state ---------------- */
  const [plate, setPlate] = useState(() => searchParams.get('plate')?.toUpperCase() ?? '');
  const [searchType, setSearchType] = useState<SearchType>('plate');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------------- workspace state ---------------- */
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  const [focusedNode, setFocusedNode] = useState<number>(4);
  const [liveTracking, setLiveTracking] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const noticeTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((msg: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3400);
  }, []);

  /* ---------------- live backend data ---------------- */
  const [searchTrigger, setSearchTrigger] = useState(0);
  const live = useVehicleSearch(plate, searchTrigger);

  /* ---------------- deep link ---------------- */
  const paramPlate = searchParams.get('plate');
  useEffect(() => {
    if (paramPlate) {
      setPlate(paramPlate.toUpperCase());
      setSearchTrigger((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramPlate]);

  /* ---------------- interactions ---------------- */
  const handleSearch = () => {
    setScanning(true);
    window.setTimeout(() => setScanning(false), 700);
    setSearchTrigger((n) => n + 1);
    flash(`Searching ${plate.replace(/\s+/g, '').toUpperCase()} across the Sentinel network…`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
    flash(`Intelligence refreshed from backend at ${clock}`);
  };

  const handleExport = () => setExportOpen(true);
  const handleSaveSearch = () => flash('Search criteria saved to your workspace · access anytime from Saved Searches');

  const handleSightingClick = (sighting: Sighting) => {
    setSelectedSighting(sighting);
    const nodeIdx = journeyNodes.findIndex((n) => n.cameraId === sighting.cameraId);
    if (nodeIdx >= 0) setFocusedNode(nodeIdx + 1);
    setEvidencePreview(sighting.snapshot);
    flash(`Evidence preview · ${sighting.cameraId} ${sighting.location} · ${sighting.timestamp}`);
  };

  const handleTrackLive = () => {
    setLiveTracking(true);
    if (profile) flash(`Live tracking activated · ${profile.plate} · ${profile.currentCamera} ${profile.currentLocation}`);
  };

  const handleViewCamera = () => { if (profile) navigate(`/live-view?camera=${profile.currentCamera}`); };

  const handleInvestigate = () => { if (profile) navigate(`/investigation?plate=${profile.plate}`); };

  const handleAddToWatchlist = () => navigate('/watchlist');

  const handleNodeClick = (step: number) => {
    setFocusedNode(step);
    const node = journeyNodes.find((n) => n.step === step);
    if (node) {
      const sighting = sightings.find((s) => s.cameraId === node.cameraId);
      if (sighting) setSelectedSighting(sighting);
    }
  };

  /* ---------------- derived ----------------
     Prefer real Vehicle Intelligence data when the backend has a record for the
     searched plate; otherwise fall back to the bundled sample so the Gujarat
     Police workspace always renders. */
  const useLive = live.found && !!live.profile;
  const profile = useLive && live.profile ? { ...vehicleProfile, ...live.profile, snapshot: live.profile.snapshot || '' } : null;
  const nodes = useLive ? live.journeyNodes : [];
  const tableSightings = useLive ? live.sightings : [];

  useEffect(() => {
    if (live.found && live.profile) {
      flash(
        `Live match · ${live.profile.plate} · ${live.profile.totalSightings} sightings` +
          (live.anomalies ? ` · ${live.anomalies} travel anomaly flagged` : ''),
      );
    } else if (live.error && searchTrigger > 0) {
      flash('No backend vehicle record found.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.found, live.error, searchTrigger]);

  return (
    <div className="page">
      {/* ==================== PAGE HEADER ==================== */}
      <VehicleSearchHeader
        clock={clock}
        onAdvancedSearch={() => setAdvancedOpen((v) => !v)}
        onExport={handleExport}
        onSave={handleSaveSearch}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ==================== SEARCH BAR ==================== */}
      <VehicleSearchBar
        plate={plate}
        onPlate={setPlate}
        searchType={searchType}
        onSearchType={setSearchType}
        onSearch={handleSearch}
        scanning={scanning}
        knownPlates={knownPlates}
        onSelectPlate={(p) => { setPlate(p); flash(`Plate ${p} loaded`); }}
      />

      {/* ==================== ADVANCED FILTERS ==================== */}
      {advancedOpen && (
        <AdvancedFiltersPanel
          filters={filters}
          onFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClose={() => setAdvancedOpen(false)}
          onReset={() => setFilters(defaultFilters)}
          onApply={() => { setAdvancedOpen(false); flash('Advanced filters applied · re-scanning the network'); }}
        />
      )}

      {/* ==================== KPI CARDS ==================== */}
      <KpiStrip />

      {/* ==================== MAIN 3-COLUMN WORKSPACE ==================== */}
      <div className="grid min-w-0 grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-[minmax(300px,32fr)_minmax(360px,40fr)_minmax(280px,28fr)]">
        {/* LEFT — Vehicle Profile */}
        {profile ? <VehicleProfilePanel profile={profile} onViewCamera={handleViewCamera} /> : <EmptyVehiclePanel />}

        {/* CENTER — Vehicle Journey (GIS Map) */}
        <VehicleJourneyPanel
          nodes={nodes}
          focusedNode={focusedNode}
          onNodeClick={handleNodeClick}
        />

        {/* RIGHT — Vehicle Intelligence */}
        {profile ? (
          <VehicleIntelligencePanel
            profile={profile}
            liveTracking={liveTracking}
            onTrackLive={handleTrackLive}
            onViewCamera={handleViewCamera}
            onAddToWatchlist={handleAddToWatchlist}
            onInvestigate={handleInvestigate}
          />
        ) : (
          <Panel title="Vehicle Intelligence" className="min-h-[320px]" bodyClassName="grid place-items-center px-4 py-6">
            <div className="text-center text-[12px] text-ink-dim">No backend vehicle dossier loaded.</div>
          </Panel>
        )}
      </div>

      {/* ==================== SIGHTING HISTORY TABLE ==================== */}
      <SightingHistoryTable
        sightings={tableSightings}
        selectedId={selectedSighting?.id ?? null}
        onSelect={handleSightingClick}
      />

      {/* ==================== EVIDENCE GALLERY ==================== */}
      <EvidenceGallery
        frames={[]}
        onPreview={(id) => setEvidencePreview(id)}
      />

      {/* ==================== RELATED EVENTS ==================== */}
      <RelatedEventsPanel events={[]} />

      {/* ==================== SEARCH ANALYTICS ==================== */}
      <div className="grid min-w-0 grid-cols-1 gap-[var(--page-gap)] lg:grid-cols-2 xl:grid-cols-[minmax(320px,35fr)_minmax(280px,30fr)_minmax(180px,17fr)_minmax(180px,18fr)]">
        <MatchesOverTimeChart data={[]} />
        <DetectionsByCameraChart data={[]} />
        <LocationsVisitedRank data={[]} />
        <MovementSummaryCard data={{ camerasCrossed: 0, journeyDuration: '—', estimatedDistance: '—', avgTimeBetweenSightings: '—' }} />
      </div>

      {/* ==================== MODALS ==================== */}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} flash={flash} />}
      {evidencePreview && (
        <EvidencePreviewModal
          snapshot={evidencePreview}
          sighting={selectedSighting}
          onClose={() => setEvidencePreview(null)}
        />
      )}

      {/* ==================== TOAST ==================== */}
      {notice && (
        <div className="fixed bottom-4 right-4 z-[80] animate-flash-in rounded-[6px] border border-accent-cyan/50 bg-[#083344] px-3.5 py-2.5 text-[12.5px] font-medium text-[#67e8f9] shadow-glow">
          {notice}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 * PAGE HEADER
 * ================================================================== */

function VehicleSearchHeader({
  clock,
  onAdvancedSearch,
  onExport,
  onSave,
  onRefresh,
  refreshing,
}: {
  clock: string;
  onAdvancedSearch: () => void;
  onExport: () => void;
  onSave: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-edge pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[5px] bg-accent-blue/15 ring-1 ring-accent-blue/30">
            <Search size={15} strokeWidth={2} className="text-accent-blue" />
          </div>
          <h1 className="page-title">Vehicle Search</h1>
        </div>
        <p className="page-sub mt-1.5">
          Search, identify and trace vehicles across the CCTV network
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdvancedSearch}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel-alt px-3 text-[12.5px] font-medium text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
        >
          <SlidersHorizontal size={13.5} strokeWidth={2} />
          Advanced Search
        </button>
        <button
          type="button"
          onClick={onExport}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-accent-blue/40 bg-accent-blue/10 px-3 text-[12.5px] font-medium text-accent-blue transition-colors hover:bg-accent-blue/20"
        >
          <Download size={13.5} strokeWidth={2} />
          Export Evidence
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel-alt px-3 text-[12.5px] font-medium text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
        >
          <Save size={13.5} strokeWidth={2} />
          Save Search
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] border border-edge bg-panel-alt px-3 text-[12.5px] font-medium text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
        >
          <RefreshCw size={13.5} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <span className="hidden text-[11.5px] text-ink-faint lg:block">{clock}</span>
      </div>
    </header>
  );
}

/* ================================================================== *
 * SEARCH BAR
 * ================================================================== */

function VehicleSearchBar({
  plate,
  onPlate,
  searchType,
  onSearchType,
  onSearch,
  scanning,
  knownPlates: plates,
  onSelectPlate,
}: {
  plate: string;
  onPlate: (v: string) => void;
  searchType: SearchType;
  onSearchType: (v: SearchType) => void;
  onSearch: () => void;
  scanning: boolean;
  knownPlates: typeof import('@/data/vehicleSearchData').knownPlates;
  onSelectPlate: (p: string) => void;
}) {
  return (
    <div className="rounded-md border border-edge bg-panel shadow-panel">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        {/* Search type pills */}
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {searchTypeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSearchType(opt.id)}
              className={`rounded-[5px] px-2.5 py-[5px] text-[11.5px] font-medium transition-colors ${
                searchType === opt.id
                  ? 'bg-accent-blue text-white shadow-[0_0_10px_-2px_rgba(47,125,255,0.6)]'
                  : 'border border-edge text-ink-dim hover:border-edge-strong hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Input + search */}
        <div className="relative flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7f9e]"
          />
          <input
            type="text"
            value={plate}
            onChange={(e) => onPlate(e.target.value)}
            placeholder="Enter vehicle plate number…"
            className="h-[40px] w-full rounded-[6px] border border-edge bg-[#0c1424] pl-10 pr-3 text-[14px] font-medium tracking-wide text-ink placeholder:text-[#6d7f9e] outline-none transition-colors focus:border-accent-blue/70 focus:shadow-glow"
          />
        </div>

        <button
          type="button"
          onClick={onSearch}
          className={`flex h-[40px] shrink-0 items-center gap-2 rounded-[6px] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-5 text-[13.5px] font-semibold text-white shadow-[0_0_14px_-4px_rgba(47,125,255,0.8)] transition-all hover:shadow-[0_0_20px_-4px_rgba(47,125,255,1)] ${
            scanning ? 'opacity-70' : ''
          }`}
        >
          {scanning ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Search size={14} strokeWidth={2.2} />
          )}
          {scanning ? 'Scanning…' : 'Search'}
        </button>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-edge-soft px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Quick Search:</span>
        {plates.map((p) => (
          <button
            key={p.plate}
            type="button"
            onClick={() => onSelectPlate(p.plate)}
            className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11.5px] font-medium transition-colors ${
              p.tone === 'red'
                ? 'border-accent-red/30 text-[#ff8b96] hover:bg-accent-red/10'
                : p.tone === 'orange'
                  ? 'border-accent-orange/30 text-[#fbbf24] hover:bg-accent-orange/10'
                  : 'border-accent-purple/30 text-[#c084fc] hover:bg-accent-purple/10'
            }`}
          >
            <span className="tnum">{p.plate}</span>
            <span className="text-[10.5px] text-ink-faint">{p.sub.split('·')[0].trim()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== *
 * ADVANCED FILTERS
 * ================================================================== */

function AdvancedFiltersPanel({
  filters,
  onFilters,
  onClose,
  onReset,
  onApply,
}: {
  filters: SearchFilters;
  onFilters: (patch: Partial<SearchFilters>) => void;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <div className="animate-fade-in rounded-md border border-edge bg-panel p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-[#dbe5f4]">
          <Filter size={14} className="text-accent-cyan" />
          Advanced Filters
        </h3>
        <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Date/Time Range */}
        <FilterGroup label="Date From">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilters({ dateFrom: e.target.value })}
            className="filter-input"
          />
        </FilterGroup>
        <FilterGroup label="Date To">
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilters({ dateTo: e.target.value })}
            className="filter-input"
          />
        </FilterGroup>
        <FilterGroup label="Time From">
          <input
            type="time"
            value={filters.timeFrom}
            onChange={(e) => onFilters({ timeFrom: e.target.value })}
            className="filter-input"
          />
        </FilterGroup>
        <FilterGroup label="Time To">
          <input
            type="time"
            value={filters.timeTo}
            onChange={(e) => onFilters({ timeTo: e.target.value })}
            className="filter-input"
          />
        </FilterGroup>

        {/* Selects */}
        <FilterGroup label="Location">
          <select value={filters.location} onChange={(e) => onFilters({ location: e.target.value })} className="filter-input">
            {locationOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Camera">
          <select value={filters.camera} onChange={(e) => onFilters({ camera: e.target.value })} className="filter-input">
            {cameraOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Direction">
          <select value={filters.direction} onChange={(e) => onFilters({ direction: e.target.value })} className="filter-input">
            {directionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Vehicle Type">
          <select value={filters.vehicleType} onChange={(e) => onFilters({ vehicleType: e.target.value })} className="filter-input">
            {vehicleTypeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Color">
          <select value={filters.color} onChange={(e) => onFilters({ color: e.target.value })} className="filter-input">
            {colorOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Watchlist Status">
          <select value={filters.watchlistStatus} onChange={(e) => onFilters({ watchlistStatus: e.target.value })} className="filter-input">
            {watchlistStatusOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label={`ANPR Confidence ≥ ${filters.minConfidence}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minConfidence}
            onChange={(e) => onFilters({ minConfidence: Number(e.target.value) })}
            className="s-range w-full"
          />
        </FilterGroup>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onReset} className="link-action">Reset</button>
        <button
          type="button"
          onClick={onApply}
          className="flex h-[34px] items-center gap-1.5 rounded-[5px] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-4 text-[12.5px] font-semibold text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.6)] transition-all hover:shadow-[0_0_18px_-4px_rgba(47,125,255,0.9)]"
        >
          <Search size={13} /> Apply Filters
        </button>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

/* ================================================================== *
 * KPI STRIP
 * ================================================================== */

function KpiStrip() {
  const kpis = [
    { label: 'Total Matches', value: '0', icon: Target, tone: 'blue' as const },
    { label: 'Cameras Detected', value: '0', icon: Camera, tone: 'cyan' as const },
    { label: 'First Seen', value: '—', icon: Clock, tone: 'green' as const },
    { label: 'Last Seen', value: '—', icon: Timer, tone: 'orange' as const },
    { label: 'Watchlist Matches', value: '0', icon: ShieldAlert, tone: 'red' as const },
  ];
  const toneMap = {
    blue: { bg: 'bg-accent-blue/10', ring: 'ring-accent-blue/25', text: 'text-accent-blue', val: 'text-white' },
    cyan: { bg: 'bg-accent-cyan/10', ring: 'ring-accent-cyan/25', text: 'text-accent-cyan', val: 'text-white' },
    green: { bg: 'bg-accent-green/10', ring: 'ring-accent-green/25', text: 'text-accent-green', val: 'text-white' },
    orange: { bg: 'bg-accent-orange/10', ring: 'ring-accent-orange/25', text: 'text-accent-orange', val: 'text-white' },
    red: { bg: 'bg-accent-red/10', ring: 'ring-accent-red/25', text: 'text-accent-red', val: 'text-white' },
  };

  return (
    <div className="grid grid-cols-2 gap-[var(--page-gap)] sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const t = toneMap[kpi.tone];
        const Icon = kpi.icon;
        return (
          <div key={kpi.label} className="panel flex items-center gap-3 p-3.5">
            <div className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[6px] ${t.bg} ring-1 ${t.ring}`}>
              <Icon size={18} strokeWidth={1.8} className={t.text} />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">{kpi.label}</div>
              <div className={`tnum text-[22px] font-bold leading-tight ${t.val}`}>{kpi.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== *
 * VEHICLE PROFILE (LEFT)
 * ================================================================== */

function EmptyVehiclePanel() {
  return (
    <Panel title="Vehicle Profile" className="min-h-[320px]" bodyClassName="grid place-items-center px-4 py-6">
      <div className="text-center">
        <Search size={28} className="mx-auto mb-3 text-ink-faint" />
        <div className="text-[14px] font-semibold text-white">No vehicle selected</div>
        <div className="mt-1 text-[12px] text-ink-dim">Search for a plate present in the backend ANPR database.</div>
      </div>
    </Panel>
  );
}

function VehicleProfilePanel({
  profile,
  onViewCamera,
}: {
  profile: typeof vehicleProfile;
  onViewCamera: () => void;
}) {
  return (
    <Panel title="Vehicle Profile" className="min-h-0">
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-1">
        {/* Snapshot + plate */}
        <div className="relative overflow-hidden rounded-[5px] border border-edge-soft bg-black">
          <img
            src={profile.snapshot}
            alt={profile.plate}
            className="h-[140px] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2.5">
            <div className="tnum text-[20px] font-bold tracking-wider text-white">{profile.plate}</div>
            {profile.watchlistMatch && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-[3px] border border-accent-red bg-accent-red/20 px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-wider text-[#ff8b96] shadow-[0_0_8px_-2px_rgba(239,68,68,0.7)]">
                <ShieldAlert size={10} /> Watchlist Match
              </span>
            )}
          </div>
        </div>

        {/* Vehicle details */}
        <div className="space-y-2 rounded-[5px] border border-edge-soft bg-[#0c1424] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Vehicle</span>
            <span className="text-[12.5px] font-medium text-ink">{profile.color} {profile.make} {profile.model}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Year</span>
            <span className="tnum text-[12.5px] text-[#dbe5f4]">{profile.year}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Color</span>
            <span className="text-[12.5px] text-[#dbe5f4]">{profile.color}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">ANPR Confidence</span>
            <span className="tnum text-[12.5px] font-semibold text-accent-green">{profile.confidence}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Total Sightings</span>
            <span className="tnum text-[12.5px] text-[#dbe5f4]">{profile.totalSightings}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">First Seen</span>
            <span className="tnum text-[12.5px] text-[#dbe5f4]">{profile.firstSeen}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Last Seen</span>
            <span className="tnum text-[12.5px] text-[#dbe5f4]">{profile.lastSeen}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">Status</span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent-green">
              <span className="relative h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-accent-green" />
                <span className="healthy-ping absolute inset-0 rounded-full text-accent-green" />
              </span>
              {profile.status}
            </span>
          </div>
        </div>

        {/* Registration */}
        <div className="rounded-[5px] border border-edge-soft p-2.5">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">Registration</div>
          <div className="mt-1 text-[12px] text-[#dbe5f4]">{profile.registrationState}</div>
          <div className="mt-0.5 text-[11px] text-ink-dim">Owner: {profile.registeredOwner}</div>
        </div>

        <button
          type="button"
          onClick={onViewCamera}
          className="flex h-[32px] items-center justify-center gap-1.5 rounded-[5px] border border-edge bg-panel-alt text-[12px] font-medium text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
        >
          <Eye size={12} /> View Current Camera
        </button>
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * VEHICLE JOURNEY — GIS MAP (CENTER)
 * ================================================================== */

function VehicleJourneyPanel({
  nodes,
  focusedNode,
  onNodeClick,
}: {
  nodes: typeof import('@/data/vehicleSearchData').journeyNodes;
  focusedNode: number;
  onNodeClick: (step: number) => void;
}) {
  return (
    <Panel title="Vehicle Journey" tools={
      <div className="flex items-center gap-1.5">
        <MapPinned size={13} className="text-accent-cyan" />
        <span className="text-[11px] text-ink-faint">GIS Route Map</span>
      </div>
    } className="min-h-[380px]">
      <div className="relative flex h-full min-h-[360px] flex-col">
        {/* Dark GIS Map Area */}
        <div className="relative mx-3 mb-3 min-h-0 flex-1 overflow-hidden rounded-[5px] border border-edge bg-[#060b14]">
          {/* Grid background */}
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 800 400">
            {/* Grid lines */}
            {Array.from({ length: 16 }, (_, i) => (
              <line key={`vg${i}`} x1={i * 50} y1={0} x2={i * 50} y2={400} stroke="#0f1a2e" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`hg${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke="#0f1a2e" strokeWidth={0.5} />
            ))}

            {/* Gujarat region outline (abstract) */}
            <path
              d="M 80 60 L 200 40 L 350 55 L 500 35 L 650 50 L 720 80 L 740 150 L 720 220 L 680 280 L 600 320 L 480 350 L 350 360 L 220 340 L 130 300 L 80 240 L 60 160 Z"
              fill="none"
              stroke="#1a2942"
              strokeWidth={1.2}
              strokeDasharray="4 3"
              opacity={0.5}
            />

            {/* City labels */}
            <text x={180} y={170} fill="#3b5278" fontSize={11} fontWeight={600} letterSpacing={2}>AHMEDABAD</text>
            <text x={480} y={120} fill="#3b5278" fontSize={11} fontWeight={600} letterSpacing={2}>GANDHINAGAR</text>

            {/* Route polyline */}
            <polyline
              points="160,200 300,170 460,130 620,100"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glow under route */}
            <polyline
              points="160,200 300,170 460,130 620,100"
              fill="none"
              stroke="#2f7dff"
              strokeWidth={8}
              strokeLinecap="round"
              opacity={0.15}
            />

            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2f7dff" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>

            {/* Node markers */}
            {nodes.map((node, i) => {
              const positions = [
                [160, 200],
                [300, 170],
                [460, 130],
                [620, 100],
              ];
              const [cx, cy] = positions[i];
              const isFocused = focusedNode === node.step;
              const isAlert = node.isWatchlistAlert;

              return (
                <g key={node.step} className="cursor-pointer" onClick={() => onNodeClick(node.step)}>
                  {/* Pulse ring for focused node */}
                  {isFocused && (
                    <>
                      <circle cx={cx} cy={cy} r={18} fill="none" stroke={isAlert ? '#ef4444' : '#2f7dff'} strokeWidth={1} opacity={0.3}>
                        <animate attributeName="r" from="14" to="28" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}
                  {/* Outer ring */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill={isAlert ? '#1c0a0a' : '#0a1428'}
                    stroke={isAlert ? '#ef4444' : isFocused ? '#22d3ee' : '#2f7dff'}
                    strokeWidth={isFocused ? 2.5 : 1.5}
                  />
                  {/* Inner number */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill={isAlert ? '#ef4444' : isFocused ? '#22d3ee' : '#2f7dff'}
                  />
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fill="white"
                    fontSize={9}
                    fontWeight={700}
                  >
                    {node.step}
                  </text>

                  {/* Label */}
                  <text
                    x={cx}
                    y={cy + 28}
                    textAnchor="middle"
                    fill={isAlert ? '#ff8b96' : '#93a3bd'}
                    fontSize={9}
                    fontWeight={isFocused ? 600 : 400}
                  >
                    {node.cameraId}
                  </text>
                  <text
                    x={cx}
                    y={cy + 39}
                    textAnchor="middle"
                    fill="#65799b"
                    fontSize={8}
                  >
                    {node.location}
                  </text>

                  {/* Timestamp */}
                  <text
                    x={cx}
                    y={cy - 20}
                    textAnchor="middle"
                    fill={isAlert ? '#fca5a5' : '#67e8f9'}
                    fontSize={8}
                    fontWeight={500}
                    fontFamily="monospace"
                  >
                    {node.timestamp}
                  </text>
                </g>
              );
            })}

            {/* Watchlist alert badge on last node */}
            {nodes[nodes.length - 1]?.isWatchlistAlert && (
              <g>
                <rect x={650} y={72} width={100} height={22} rx={3} fill="#1c0a0a" stroke="#ef4444" strokeWidth={1} />
                <text x={700} y={87} textAnchor="middle" fill="#ff8b96" fontSize={9} fontWeight={700}>
                  ⚠ WATCHLIST ALERT
                </text>
              </g>
            )}

            {/* Direction arrows on route segments */}
            <polygon points="230,185 240,180 230,175" fill="#2f7dff" opacity={0.7} />
            <polygon points="380,150 390,145 380,140" fill="#22d3ee" opacity={0.7} />
            <polygon points="540,115 550,110 540,105" fill="#22d3ee" opacity={0.7} />
          </svg>

          {/* Map corner info */}
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-[3px] bg-black/60 px-2 py-1 text-[10px] text-ink-faint backdrop-blur-sm">
            <Compass size={10} className="text-accent-cyan" />
            Gujarat · Ahmedabad–Gandhinagar Belt
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-[3px] bg-black/60 px-2 py-1 text-[10px] text-ink-faint backdrop-blur-sm">
            <Navigation size={10} className="text-accent-green" />
            4 nodes · 21.8 km
          </div>
        </div>

        {/* Journey timeline strip */}
        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-t border-edge-soft px-3 py-2.5 scroll-thin">
          {nodes.map((node, i) => (
            <div key={node.step} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => onNodeClick(node.step)}
                className={`flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 transition-colors ${
                  focusedNode === node.step
                    ? node.isWatchlistAlert
                      ? 'bg-accent-red/10 ring-1 ring-accent-red/40'
                      : 'bg-accent-blue/10 ring-1 ring-accent-blue/40'
                    : 'hover:bg-panel-hover'
                }`}
              >
                <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-bold text-white ${
                  node.isWatchlistAlert ? 'bg-accent-red' : focusedNode === node.step ? 'bg-accent-cyan' : 'bg-accent-blue'
                }`}>
                  {node.step}
                </span>
                <div className="text-left leading-tight">
                  <div className="text-[11px] font-medium text-ink">{node.cameraId}</div>
                  <div className="text-[10px] text-ink-faint">{node.timestamp}</div>
                </div>
              </button>
              {i < nodes.length - 1 && (
                <ArrowRight size={12} className="mx-1 shrink-0 text-ink-faint" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * VEHICLE INTELLIGENCE (RIGHT)
 * ================================================================== */

function VehicleIntelligencePanel({
  profile,
  liveTracking,
  onTrackLive,
  onViewCamera,
  onAddToWatchlist,
  onInvestigate,
}: {
  profile: typeof vehicleProfile;
  liveTracking: boolean;
  onTrackLive: () => void;
  onViewCamera: () => void;
  onAddToWatchlist: () => void;
  onInvestigate: () => void;
}) {
  return (
    <Panel title="Vehicle Intelligence" tools={
      liveTracking ? (
        <span className="flex items-center gap-1.5 rounded-[3px] bg-accent-green/10 px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider text-accent-green ring-1 ring-accent-green/25">
          <span className="relative h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent-green" />
            <span className="healthy-ping absolute inset-0 rounded-full text-accent-green" />
          </span>
          Live
        </span>
      ) : (
        <span className="text-[10px] text-ink-faint">Intelligence</span>
      )
    } className="min-h-0">
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-1">
        {/* Current location */}
        <div className="rounded-[5px] border border-edge-soft bg-[#0c1424] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
            <MapPin size={10} className="text-accent-cyan" />
            Current Position
          </div>
          <div className="space-y-1.5">
            <IntelRow label="Camera" value={profile.currentCamera} highlight="text-accent-cyan" />
            <IntelRow label="Location" value={`${profile.currentLocation}, ${profile.currentCity}`} />
            <IntelRow label="Direction" value={profile.currentDirection} icon={<Navigation size={10} className="text-accent-green" />} />
            <IntelRow label="Speed" value={`${profile.currentSpeed} km/h`} icon={<Gauge size={10} className="text-accent-orange" />} />
            <IntelRow label="Detection" value={`${profile.detectionConfidence}%`} highlight="text-accent-green" />
          </div>
        </div>

        {/* Watchlist category */}
        <div className={`rounded-[5px] border p-2.5 ${
          profile.watchlistMatch
            ? 'border-accent-red/30 bg-accent-red/5'
            : 'border-edge-soft bg-[#0c1424]'
        }`}>
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={11} className={profile.watchlistMatch ? 'text-accent-red' : 'text-ink-faint'} />
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">Watchlist</span>
          </div>
          <div className={`mt-1 text-[12px] font-semibold ${profile.watchlistMatch ? 'text-[#ff8b96]' : 'text-ink-dim'}`}>
            {profile.watchlistCategory}
          </div>
        </div>

        {/* Latest event */}
        <div className="rounded-[5px] border border-edge-soft bg-[#0c1424] p-2.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
            <Zap size={10} className="text-accent-orange" />
            Latest Event
          </div>
          <div className="mt-1 text-[12px] font-medium text-[#fbbf24]">{profile.latestEvent}</div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTrackLive}
            className={`flex h-[34px] items-center justify-center gap-1.5 rounded-[5px] text-[11.5px] font-semibold transition-all ${
              liveTracking
                ? 'bg-accent-green/20 text-accent-green ring-1 ring-accent-green/40'
                : 'bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] text-white shadow-[0_0_10px_-3px_rgba(47,125,255,0.6)] hover:shadow-[0_0_16px_-3px_rgba(47,125,255,0.9)]'
            }`}
          >
            <Crosshair size={12} />
            {liveTracking ? 'Tracking…' : 'Track Live'}
          </button>
          <button
            type="button"
            onClick={onViewCamera}
            className="flex h-[34px] items-center justify-center gap-1.5 rounded-[5px] border border-edge bg-panel-alt text-[11.5px] font-medium text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
          >
            <Camera size={12} /> View Camera
          </button>
          <button
            type="button"
            onClick={onAddToWatchlist}
            className="flex h-[34px] items-center justify-center gap-1.5 rounded-[5px] border border-accent-orange/30 bg-accent-orange/5 text-[11.5px] font-medium text-[#fbbf24] transition-colors hover:bg-accent-orange/10"
          >
            <Plus size={12} /> Add to Watchlist
          </button>
          <button
            type="button"
            onClick={onInvestigate}
            className="flex h-[34px] items-center justify-center gap-1.5 rounded-[5px] border border-accent-purple/30 bg-accent-purple/5 text-[11.5px] font-medium text-[#c084fc] transition-colors hover:bg-accent-purple/10"
          >
            <Radar size={12} /> Investigate
          </button>
        </div>
      </div>
    </Panel>
  );
}

function IntelRow({ label, value, highlight, icon }: { label: string; value: string; highlight?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className={`flex items-center gap-1 text-[12px] font-medium ${highlight ?? 'text-[#dbe5f4]'}`}>
        {icon}
        {value}
      </span>
    </div>
  );
}

/* ================================================================== *
 * SIGHTING HISTORY TABLE
 * ================================================================== */

function SightingHistoryTable({
  sightings: rows,
  selectedId,
  onSelect,
}: {
  sightings: Sighting[];
  selectedId: string | null;
  onSelect: (s: Sighting) => void;
}) {
  return (
    <Panel title="Sighting History" tools={
      <span className="text-[11px] text-ink-faint">{rows.length} sightings</span>
    }>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[800px] text-left">
          <thead>
            <tr className="border-b border-edge-soft text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
              <th className="px-3.5 py-2">Timestamp</th>
              <th className="px-3.5 py-2">Camera ID</th>
              <th className="px-3.5 py-2">Location</th>
              <th className="px-3.5 py-2">Direction</th>
              <th className="px-3.5 py-2">Vehicle Type</th>
              <th className="px-3.5 py-2">Confidence</th>
              <th className="px-3.5 py-2">Match Status</th>
              <th className="px-3.5 py-2 text-right">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-edge-soft/50 transition-colors ${
                  selectedId === row.id
                    ? 'bg-accent-blue/5 hover:bg-accent-blue/10'
                    : 'hover:bg-panel-hover'
                }`}
              >
                <td className="tnum whitespace-nowrap px-3.5 py-2.5 text-[12.5px] text-ink">{row.timestamp}</td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-[12.5px] font-medium text-accent-cyan">{row.cameraId}</td>
                <td className="px-3.5 py-2.5">
                  <div className="text-[12.5px] text-[#dbe5f4]">{row.location}</div>
                  <div className="text-[10.5px] text-ink-faint">{row.city}</div>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-[12.5px] text-[#dbe5f4]">
                  <span className="flex items-center gap-1">
                    <Navigation size={10} className="text-ink-faint" />
                    {row.direction}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-[12.5px] text-[#dbe5f4]">{row.vehicleType}</td>
                <td className="tnum whitespace-nowrap px-3.5 py-2.5">
                  <span className={`text-[12.5px] font-semibold ${
                    row.confidence >= 97 ? 'text-accent-green' : row.confidence >= 93 ? 'text-[#67e8f9]' : 'text-[#fbbf24]'
                  }`}>
                    {row.confidence}%
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5">
                  <span className={`rounded-[3px] px-1.5 py-[2px] text-[10.5px] font-semibold ${
                    row.matchStatus === 'Matched'
                      ? 'bg-accent-green/10 text-accent-green ring-1 ring-accent-green/20'
                      : row.matchStatus === 'Confirmed'
                        ? 'bg-accent-blue/10 text-accent-blue ring-1 ring-accent-blue/20'
                        : row.matchStatus === 'Pending'
                          ? 'bg-accent-orange/10 text-accent-orange ring-1 ring-accent-orange/20'
                          : 'bg-panel-alt text-ink-faint ring-1 ring-edge'
                  }`}>
                    {row.matchStatus}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(row); }}
                      className="flex items-center gap-1 rounded-[3px] border border-edge px-1.5 py-[2px] text-[10.5px] text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
                    >
                      <Image size={9} /> Snapshot
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(row); }}
                      className="flex items-center gap-1 rounded-[3px] border border-edge px-1.5 py-[2px] text-[10.5px] text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
                    >
                      <MapPin size={9} /> Map
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * EVIDENCE GALLERY
 * ================================================================== */

function EvidenceGallery({
  frames,
  onPreview,
}: {
  frames: typeof evidenceFrames;
  onPreview: (id: string) => void;
}) {
  return (
    <Panel title="Evidence Gallery" tools={
      <span className="text-[11px] text-ink-faint">{frames.length} CCTV snapshots</span>
    }>
      <div className="grid grid-cols-2 gap-3 px-3.5 pb-3.5 sm:grid-cols-4">
        {frames.map((frame) => (
          <button
            key={frame.id}
            type="button"
            onClick={() => onPreview(frame.id)}
            className="group relative overflow-hidden rounded-[5px] border border-edge-soft transition-all hover:border-accent-blue/40 hover:shadow-glow"
          >
            <img
              src={frame.snapshot}
              alt={`${frame.cameraId} evidence`}
              className="h-[110px] w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-accent-cyan">{frame.cameraId}</span>
                <span className="tnum text-[10px] text-accent-green">{frame.confidence}%</span>
              </div>
              <div className="text-[10px] text-ink-dim">{frame.timestamp}</div>
              <div className="text-[10px] text-ink-faint">{frame.location}, {frame.city}</div>
            </div>
            <div className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-[3px] bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Eye size={11} className="text-white" />
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * RELATED EVENTS
 * ================================================================== */

function RelatedEventsPanel({ events }: { events: typeof relatedEvents }) {
  const severityStyles = {
    critical: { border: 'border-accent-red/30', bg: 'bg-accent-red/5', text: 'text-[#ff8b96]', icon: 'text-accent-red' },
    high: { border: 'border-accent-orange/30', bg: 'bg-accent-orange/5', text: 'text-[#fbbf24]', icon: 'text-accent-orange' },
    medium: { border: 'border-accent-purple/30', bg: 'bg-accent-purple/5', text: 'text-[#c084fc]', icon: 'text-accent-purple' },
    info: { border: 'border-accent-cyan/30', bg: 'bg-accent-cyan/5', text: 'text-[#67e8f9]', icon: 'text-accent-cyan' },
  };
  const iconMap = {
    'Watchlist Match': ShieldAlert,
    'Speed Violation': Gauge,
    'Wrong Direction': AlertTriangle,
    'ANPR Plate Variance': Activity,
  };

  return (
    <Panel title="Related Events" tools={
      <span className="text-[11px] text-ink-faint">{events.length} events</span>
    }>
      <div className="grid grid-cols-1 gap-2.5 px-3.5 pb-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {events.map((event) => {
          const style = severityStyles[event.severity];
          const Icon = iconMap[event.title as keyof typeof iconMap] ?? Zap;
          return (
            <div
              key={event.id}
              className={`rounded-[5px] border ${style.border} ${style.bg} p-3 transition-colors hover:border-edge-strong`}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Icon size={13} className={style.icon} />
                <span className={`text-[12px] font-semibold ${style.text}`}>{event.title}</span>
              </div>
              <div className="text-[11px] text-ink-dim">{event.detail.slice(0, 80)}…</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-ink-faint">{event.cameraId} · {event.timestamp}</span>
                <span className="tnum text-[10px] font-medium text-ink-dim">{event.metric}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * SEARCH ANALYTICS — Charts (pure SVG, no chart library)
 * ================================================================== */

function MatchesOverTimeChart({ data }: { data: typeof matchesOverTime }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 400;
  const h = 140;
  const padX = 32;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * innerW,
    y: padY + innerH - (d.value / max) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`;

  return (
    <Panel title="Matches Over Time" tools={<span className="text-[10px] text-ink-faint">Line Chart</span>}>
      <div className="px-2 pb-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={padX} y1={padY + innerH * f} x2={padX + innerW} y2={padY + innerH * f} stroke="#152238" strokeWidth={0.5} />
          ))}
          {/* Area */}
          <path d={areaPath} fill="url(#lineAreaGrad)" opacity={0.3} />
          {/* Line */}
          <path d={linePath} fill="none" stroke="#2f7dff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2f7dff" stroke="#0b1222" strokeWidth={1.5} />
          ))}
          {/* X labels */}
          {data.filter((_, i) => i % 3 === 0).map((d, idx) => (
            <text key={idx} x={padX + ((idx * 3) / (data.length - 1)) * innerW} y={h - 2} textAnchor="middle" fill="#65799b" fontSize={8}>
              {d.label}
            </text>
          ))}
          <defs>
            <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f7dff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#2f7dff" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </Panel>
  );
}

function DetectionsByCameraChart({ data }: { data: typeof detectionsByCamera }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <Panel title="Detections by Camera" tools={<span className="text-[10px] text-ink-faint">Bar Chart</span>}>
      <div className="flex flex-col gap-2 px-3.5 pb-3">
        {data.map((d) => (
          <div key={d.cameraId} className="flex items-center gap-2">
            <span className="w-[48px] shrink-0 text-[11px] font-medium text-accent-cyan">{d.cameraId}</span>
            <div className="flex-1">
              <div className="h-[18px] overflow-hidden rounded-[3px] bg-[#0c1424]">
                <div
                  className="flex h-full items-center rounded-[3px] bg-gradient-to-r from-accent-blue/80 to-accent-cyan/80 px-1.5 transition-all"
                  style={{ width: `${(d.count / max) * 100}%` }}
                >
                  <span className="tnum text-[10px] font-bold text-white">{d.count}</span>
                </div>
              </div>
            </div>
            <span className="w-[90px] shrink-0 truncate text-right text-[10px] text-ink-faint">{d.location}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LocationsVisitedRank({ data }: { data: typeof locationsVisited }) {
  return (
    <Panel title="Locations Visited" tools={<span className="text-[10px] text-ink-faint">Ranking</span>}>
      <div className="flex flex-col gap-1.5 px-3.5 pb-3">
        {data.map((loc, i) => (
          <div key={loc.label} className="flex items-center gap-2 rounded-[3px] p-1.5 hover:bg-panel-hover">
            <span className={`grid h-[20px] w-[20px] place-items-center rounded-[3px] text-[10px] font-bold ${
              i === 0 ? 'bg-accent-blue/20 text-accent-blue' : 'bg-panel-alt text-ink-faint'
            }`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] text-[#dbe5f4]">{loc.label}</div>
              <div className="text-[10px] text-ink-faint">{loc.city}</div>
            </div>
            <span className="tnum text-[12px] font-semibold text-white">{loc.count}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MovementSummaryCard({ data }: { data: typeof movementSummary }) {
  const items = [
    { label: 'Cameras Crossed', value: String(data.camerasCrossed), icon: Camera, tone: 'text-accent-cyan' },
    { label: 'Journey Duration', value: data.journeyDuration, icon: Timer, tone: 'text-accent-green' },
    { label: 'Est. Distance', value: data.estimatedDistance, icon: Route, tone: 'text-accent-blue' },
    { label: 'Avg. Time Between', value: data.avgTimeBetweenSightings, icon: Clock, tone: 'text-accent-orange' },
  ];

  return (
    <Panel title="Movement Summary" tools={<span className="text-[10px] text-ink-faint"><TrendingUp size={10} className="inline" /></span>}>
      <div className="flex flex-col gap-2.5 px-3.5 pb-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2.5">
              <Icon size={14} strokeWidth={1.8} className={`shrink-0 ${item.tone}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-ink-faint">{item.label}</div>
                <div className={`tnum text-[13px] font-semibold ${item.tone}`}>{item.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ================================================================== *
 * EXPORT DIALOG
 * ================================================================== */

function ExportDialog({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [includeSnapshots, setIncludeSnapshots] = useState(true);
  const [includeRoute, setIncludeRoute] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);

  const handleExport = () => {
    onClose();
    flash(`Evidence exported as ${format.toUpperCase()} · ${includeSnapshots ? 'snapshots included' : 'no snapshots'} · ${includeRoute ? 'route map' : ''} ${includeEvents ? '· events' : ''}`);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-fade-in w-[420px] rounded-md border border-edge bg-panel shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wider text-white">
            <Download size={14} className="text-accent-blue" />
            Export Evidence
          </h3>
          <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          {/* Format */}
          <div>
            <label className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">Format</label>
            <div className="mt-1.5 flex gap-2">
              {(['pdf', 'csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-[5px] border py-2 text-center text-[12px] font-semibold uppercase transition-colors ${
                    format === f
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-edge text-ink-dim hover:border-edge-strong hover:text-ink'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* Options */}
          <div className="space-y-2">
            <CheckOption label="Include CCTV Snapshots" checked={includeSnapshots} onChange={setIncludeSnapshots} />
            <CheckOption label="Include Route Map" checked={includeRoute} onChange={setIncludeRoute} />
            <CheckOption label="Include Related Events" checked={includeEvents} onChange={setIncludeEvents} />
          </div>
          {/* Summary */}
          <div className="rounded-[5px] border border-edge-soft bg-[#0c1424] p-2.5 text-[11px] text-ink-dim">
            <div>Plate: <span className="font-semibold text-white">Backend search result</span></div>
            <div>Sightings: <span className="tnum font-semibold text-white">0</span> · Evidence Frames: <span className="tnum font-semibold text-white">0</span></div>
            <div>Events: <span className="tnum font-semibold text-white">0</span> · Route Nodes: <span className="tnum font-semibold text-white">0</span></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-edge px-4 py-3">
          <button type="button" onClick={onClose} className="link-action">Cancel</button>
          <button
            type="button"
            onClick={handleExport}
            className="flex h-[34px] items-center gap-1.5 rounded-[5px] bg-gradient-to-r from-[#1f5fd8] to-[#1a4fb5] px-4 text-[12.5px] font-semibold text-white shadow-[0_0_12px_-4px_rgba(47,125,255,0.6)]"
          >
            <Download size={13} /> Export Now
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-[4px] p-1.5 transition-colors hover:bg-panel-hover">
      <div
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[3px] border transition-colors ${
          checked ? 'border-accent-blue bg-accent-blue' : 'border-edge bg-[#0c1424]'
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && <ChevronRight size={10} className="text-white -rotate-90" />}
      </div>
      <span className="text-[12px] text-[#dbe5f4]" onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

/* ================================================================== *
 * EVIDENCE PREVIEW MODAL
 * ================================================================== */

function EvidencePreviewModal({
  snapshot,
  sighting,
  onClose,
}: {
  snapshot: string;
  sighting: Sighting | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-fade-in w-[520px] overflow-hidden rounded-md border border-edge bg-panel shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-white">
            <Image size={14} className="text-accent-cyan" />
            Evidence Preview
          </h3>
          <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <img src={snapshot} alt="Evidence snapshot" className="h-[280px] w-full object-cover" />
        {sighting && (
          <div className="grid grid-cols-2 gap-2 border-t border-edge p-3.5 text-[11.5px]">
            <div><span className="text-ink-faint">Camera:</span> <span className="font-medium text-accent-cyan">{sighting.cameraId}</span></div>
            <div><span className="text-ink-faint">Location:</span> <span className="font-medium text-ink">{sighting.location}, {sighting.city}</span></div>
            <div><span className="text-ink-faint">Time:</span> <span className="tnum font-medium text-ink">{sighting.timestamp}</span></div>
            <div><span className="text-ink-faint">Confidence:</span> <span className="tnum font-semibold text-accent-green">{sighting.confidence}%</span></div>
            <div><span className="text-ink-faint">Direction:</span> <span className="font-medium text-ink">{sighting.direction}</span></div>
            <div><span className="text-ink-faint">Speed:</span> <span className="tnum font-medium text-ink">{sighting.speedKph} km/h</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
