import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AddWatchlistModal } from '@/components/watchlist/AddWatchlistModal';
import { CrossCameraJourneyPanel } from '@/components/investigation/CrossCameraJourneyPanel';
import { CreateCaseModal, type NewCaseInput } from '@/components/investigation/CreateCaseModal';
import { EvidenceGalleryPanel } from '@/components/investigation/EvidenceGalleryPanel';
import { EvidenceViewerModal } from '@/components/investigation/EvidenceViewerModal';
import { InvestigationActionBar } from '@/components/investigation/InvestigationActionBar';
import {
  CameraFrequencyPanel,
  LocationDistributionPanel,
  SightingsOverTimePanel,
} from '@/components/investigation/InvestigationAnalytics';
import { InvestigationDetailsPanel } from '@/components/investigation/InvestigationDetailsPanel';
import { InvestigationHeader } from '@/components/investigation/InvestigationHeader';
import { InvestigationSearchPanel } from '@/components/investigation/InvestigationSearchPanel';
import { RelatedEventsPanel } from '@/components/investigation/RelatedEventsPanel';
import { RelatedVehiclesPanel } from '@/components/investigation/RelatedVehiclesPanel';
import { RouteAnalysisPanel } from '@/components/investigation/RouteAnalysisPanel';
import { SightingHistoryPanel } from '@/components/investigation/SightingHistoryPanel';
import { TargetVehicleCard } from '@/components/investigation/TargetVehicleCard';
import {
  buildEvidence,
  buildRouteLegs,
  cameraOptionsOf,
  caseBundle,
  computeInvestigationAnalytics,
  computeRouteAnalysis,
  defaultSightingQuery,
  defaultTargetPlate,
  dossierLegs,
  filterSightings,
  investigationDossiers,
  nextCaseRef,
  primaryRoute,
  recentInvestigations,
  searchCandidates,
  sortSightings,
} from '@/data/investigationData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import type {
  Association,
  InvestigationFilters,
  InvestigationStatus,
  RelatedEvent,
  SightingQuery,
  SightingSortDir,
  SightingSortKey,
  SearchCandidate,
  SearchMode,
  VehicleSighting,
} from '@/types/investigation';

const defaultFilters: InvestigationFilters = {
  date: '2026-09-01',
  range: 'day',
  location: 'all',
  camera: 'all',
};

/**
 * INVESTIGATION & VEHICLE INTELLIGENCE workspace: target dossier, cross-camera
 * journey reconstruction, sighting history, related events / associations,
 * evidence gallery and the case tooling. Frontend mock data only — every block
 * is fed by a pure selector in `data/investigationData.ts` so the page can be
 * swapped onto ANPR / tracking / GIS / WebSocket services without a rewrite.
 */
export function Investigation() {
  const navigate = useNavigate();
  const clock = formatClock(useLiveClock());

  /* ---------------- target + search state ---------------- */
  const [targetPlate, setTargetPlate] = useState(defaultTargetPlate);
  const [plate, setPlate] = useState(defaultTargetPlate);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('vehicle');
  const [fuzzy, setFuzzy] = useState(true);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [includeReReads, setIncludeReReads] = useState(true);
  const [scanning, setScanning] = useState(false);

  /* ---------------- workspace state ---------------- */
  const [filters, setFilters] = useState<InvestigationFilters>(defaultFilters);
  const [sightingQuery, setSightingQuery] = useState<SightingQuery>(defaultSightingQuery);
  const [sortKey, setSortKey] = useState<SightingSortKey>('time');
  const [sortDir, setSortDir] = useState<SightingSortDir>('asc');
  const [activeStep, setActiveStep] = useState<number | null>(4);
  const [frameToken, setFrameToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<InvestigationStatus>('active');
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);
  /** Bumped on every open so the case form remounts with fresh prefilled state. */
  const [caseToken, setCaseToken] = useState(0);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [fullscreenRequest, setFullscreenRequest] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const dossier = investigationDossiers[targetPlate];

  /* ---------------- derived intelligence ---------------- */

  const dossierSightings = useMemo(
    () => [...dossier.sightings].sort((a, b) => a.seconds - b.seconds),
    [dossier],
  );

  /** Header location / camera filters + the re-read preference. */
  const scopedSightings = useMemo(
    () =>
      dossierSightings.filter((sighting) => {
        if (!includeReReads && sighting.reRead) return false;
        if (filters.location !== 'all' && sighting.city !== filters.location) return false;
        if (filters.camera !== 'all' && sighting.cameraId !== filters.camera) return false;
        return true;
      }),
    [dossierSightings, includeReReads, filters.location, filters.camera],
  );

  const visibleSightings = useMemo(
    () => sortSightings(filterSightings(scopedSightings, sightingQuery), sortKey, sortDir),
    [scopedSightings, sightingQuery, sortKey, sortDir],
  );

  const nodes = useMemo(() => primaryRoute(dossierSightings), [dossierSightings]);
  const legs = useMemo(() => buildRouteLegs(dossierSightings, dossierLegs(dossier)), [dossierSightings, dossier]);
  const analysis = useMemo(() => computeRouteAnalysis(dossierSightings), [dossierSightings]);
  const analytics = useMemo(() => computeInvestigationAnalytics(scopedSightings), [scopedSightings]);
  const cameraOptions = useMemo(() => cameraOptionsOf(dossierSightings), [dossierSightings]);
  const cityOptions = useMemo(() => [...new Set(dossierSightings.map((s) => s.city))], [dossierSightings]);

  const events = useMemo<RelatedEvent[]>(
    () => dossier.events.map((event) => ({ ...event, acknowledged: event.acknowledged || acknowledged.includes(event.id) })),
    [dossier.events, acknowledged],
  );

  const allEvidence = useMemo(() => buildEvidence(scopedSightings), [scopedSightings]);
  const evidence = useMemo(() => {
    if (evidenceFilter === 'route') return allEvidence.filter((item) => item.primary);
    if (evidenceFilter === 'watchlist') return allEvidence.filter((item) => item.watchlistHit);
    if (evidenceFilter.startsWith('cam:')) return allEvidence.filter((item) => item.cameraId === evidenceFilter.slice(4));
    return allEvidence;
  }, [allEvidence, evidenceFilter]);

  const candidates = useMemo(() => {
    const needle = (mode === 'vehicle' ? plate : query).trim().toLowerCase();
    return searchCandidates.filter((candidate) => {
      if (candidate.kind !== mode) return false;
      if (watchlistOnly && candidate.tone !== 'red' && candidate.tone !== 'orange') return false;
      if (!needle) return true;
      const haystack = `${candidate.label} ${candidate.sub} ${candidate.meta}`.toLowerCase();
      return fuzzy ? haystack.includes(needle) : candidate.label.toLowerCase().startsWith(needle);
    });
  }, [mode, plate, query, fuzzy, watchlistOnly]);

  const selectedSighting = useMemo(
    () => (evidenceId ? scopedSightings.find((sighting) => sighting.id === evidenceId) ?? null : null),
    [evidenceId, scopedSightings],
  );
  const sightingIndex = selectedSighting ? scopedSightings.findIndex((s) => s.id === selectedSighting.id) + 1 : 0;
  const lastSighting = dossierSightings[dossierSightings.length - 1];

  /* ---------------- replay ---------------- */

  useEffect(() => {
    if (!playing || nodes.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        const index = nodes.findIndex((node) => node.journeyStep === current);
        const next = nodes[(index + 1) % nodes.length];
        return next.journeyStep ?? null;
      });
    }, 1600);
    return () => window.clearInterval(timer);
  }, [playing, nodes]);

  /* ---------------- interactions ---------------- */

  const selectTarget = useCallback(
    (nextPlate: string, message: string) => {
      const next = investigationDossiers[nextPlate];
      if (!next) {
        flash(`No dossier indexed for ${nextPlate.toUpperCase()} in this window`);
        return;
      }
      setTargetPlate(nextPlate);
      setPlate(nextPlate);
      setStatus(next.status);
      setCaseRef(null);
      setAcknowledged([]);
      setSightingQuery(defaultSightingQuery);
      setEvidenceFilter('all');
      setActiveStep(primaryRoute(next.sightings).at(-1)?.journeyStep ?? null);
      setFrameToken((token) => token + 1);
      flash(message);
    },
    [flash],
  );

  const handleSearch = () => {
    setScanning(true);
    window.setTimeout(() => setScanning(false), 620);

    const value = (mode === 'vehicle' ? plate : query).trim();
    const exact = Object.keys(investigationDossiers).find(
      (key) => key.toLowerCase() === value.toLowerCase(),
    );
    if (mode === 'vehicle' && exact) {
      selectTarget(exact, `Dossier loaded · ${exact} · ${investigationDossiers[exact].sightings.length} sightings reconstructed`);
      return;
    }
    const candidate = candidates[0];
    if (candidate) {
      selectTarget(candidate.targetId, `${candidate.label} resolved to ${candidate.targetId} · ${candidate.meta}`);
      return;
    }
    flash(`No index match for “${value}” — try a partial plate with fuzzy matching enabled`);
  };

  const handleCandidate = (candidate: SearchCandidate) =>
    selectTarget(candidate.targetId, `${candidate.label} · ${candidate.sub} loaded into the workspace`);

  const handleStep = (step: number) => {
    setActiveStep(step);
    setFrameToken((token) => token + 1);
  };

  const openEvidence = (sightingId: string, fullscreen = false) => {
    setEvidenceId(sightingId);
    setFullscreenRequest(fullscreen);
  };

  const stepEvidence = (direction: -1 | 1) => {
    if (scopedSightings.length === 0) return;
    const index = scopedSightings.findIndex((sighting) => sighting.id === evidenceId);
    const next = scopedSightings[(index + direction + scopedSightings.length) % scopedSightings.length];
    setEvidenceId(next.id);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 800);
    flash(
      `Investigation re-synced · ${dossierSightings.length} sightings · ${analysis.camerasCrossed} cameras · ${events.length} linked events`,
    );
  };

  const handleExportCase = () => {
    const bundle = caseBundle(
      dossier,
      caseRef ? `${dossier.target.plate} — ${dossier.title}` : `${dossier.target.plate} — ${dossier.title} (draft)`,
      status === 'closed' ? 'low' : dossier.priority,
      `${dossier.caseId} exported from the investigation console at ${clock}.`,
      evidence.map((item) => item.id),
    );
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gp-${dossier.caseId.toLowerCase()}-case.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Case bundle exported · ${dossier.caseId} · ${evidence.length} evidence references`);
  };

  const handleExportEvidence = () => {
    const header = [
      'evidence_id',
      'sighting_id',
      'camera_id',
      'location',
      'city',
      'time',
      'confidence_pct',
      'clip',
      'route_node',
      'watchlist',
      'tags',
    ];
    const rows = evidence.map((item) =>
      [
        item.id,
        item.sightingId,
        item.cameraId,
        item.location,
        item.city,
        item.time,
        item.confidence.toFixed(1),
        item.clip,
        item.primary ? 'yes' : 'no',
        item.watchlistHit ? 'yes' : 'no',
        item.tags.join(' | '),
      ]
        .map((cell) => (String(cell).includes(',') ? `"${cell}"` : String(cell)))
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gp-${dossier.caseId.toLowerCase()}-evidence.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Evidence manifest exported · ${evidence.length} frames`);
  };

  /*
   * Mock filing. Once the case service exists this becomes
   * `api.createInvestigationCase(plate, { investigationId: dossier.caseId, ...input })`
   * — `NewCaseInput` is already that request body.
   */
  const handleCreateCase = (input: NewCaseInput) => {
    const ref = nextCaseRef(caseRef);
    setCaseRef(ref);
    setStatus('escalated');
    setCaseOpen(false);
    flash(`${ref} created · ${input.priority} priority · ${input.evidenceIds.length} evidence frames attached`);
  };

  const handleCloseInvestigation = () => {
    setStatus('closed');
    setPlaying(false);
    flash(`${dossier.caseId} closed and archived · ${evidence.length} frames retained for 90 days`);
  };

  const handleNewInvestigation = () => {
    setPlate('');
    setQuery('');
    setFilters(defaultFilters);
    setSightingQuery(defaultSightingQuery);
    setEvidenceFilter('all');
    setCaseRef(null);
    setStatus('active');
    setPlaying(false);
    flash('New investigation opened · enter a plate, camera or person to begin the reconstruction');
  };

  const handleSort = (key: SightingSortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'time' || key === 'confidence' ? 'asc' : 'asc');
    }
  };

  const viewCamera = (cameraId: string) => navigate(`/live-view?camera=${cameraId}`);

  const openAssociation = (association: Association) => {
    if (!association.targetId) return;
    selectTarget(association.targetId, `${association.label} opened · ${association.kindLabel} association`);
  };

  const sightingQueryDirty =
    sightingQuery.camera !== 'all' ||
    sightingQuery.city !== 'all' ||
    sightingQuery.minConfidence !== 0 ||
    sightingQuery.primaryOnly ||
    sightingQuery.query !== '';

  return (
    <div className="page">
      <InvestigationHeader
        caseId={dossier.caseId}
        status={status}
        openedAt={dossier.openedAt}
        openedBy={dossier.openedBy}
        unit={dossier.unit}
        plate={plate}
        onPlate={setPlate}
        onSearch={handleSearch}
        filters={filters}
        onFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        cameraOptions={cameraOptions}
        onNew={handleNewInvestigation}
        onExport={handleExportCase}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        clock={clock}
        sightingCount={dossierSightings.length}
      />

      <InvestigationSearchPanel
        mode={mode}
        onMode={setMode}
        plate={plate}
        onPlate={setPlate}
        query={query}
        onQuery={setQuery}
        onSearch={handleSearch}
        candidates={candidates}
        onSelect={handleCandidate}
        recents={recentInvestigations}
        onRecent={(recent) => selectTarget(recent.targetId, `${recent.id} reopened · ${recent.sub}`)}
        activePlate={targetPlate}
        fuzzy={fuzzy}
        onFuzzy={setFuzzy}
        watchlistOnly={watchlistOnly}
        onWatchlistOnly={setWatchlistOnly}
        includeReReads={includeReReads}
        onIncludeReReads={setIncludeReReads}
        scanning={scanning}
        indexMeta={{ cameras: '12,842', plates: '18,729', synced: clock }}
      />

      {/* target + journey + details rail */}
      <div className="flex shrink-0 flex-col gap-[var(--page-gap)] lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--page-gap)]">
          <TargetVehicleCard
            dossier={dossier}
            onOpenEvidence={(id) => openEvidence(id)}
            onViewCamera={viewCamera}
            onOpenWatchlist={() => navigate('/watchlist')}
          />

          <div className="flex min-h-[420px] shrink-0 flex-col [&>*]:flex-1">
            <CrossCameraJourneyPanel
              dossier={dossier}
              legs={legs}
              nodes={nodes}
              activeStep={activeStep}
              onSelectStep={handleStep}
              onOpenEvidence={(id) => openEvidence(id)}
              onViewCamera={viewCamera}
              frameToken={frameToken}
              playing={playing}
              onToggleReplay={() => setPlaying((value) => !value)}
            />
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[350px] lg:min-w-[330px]">
          <InvestigationDetailsPanel
            dossier={dossier}
            status={status}
            caseRef={caseRef}
            lastSync={clock}
            onOpenCamera={viewCamera}
            onOpenEvidence={(id) => openEvidence(id)}
            onEscalate={() => {
              setStatus('escalated');
              flash(`${dossier.caseId} escalated to the control-room duty officer`);
            }}
          />
        </aside>
      </div>

      <div className="flex min-h-[360px] shrink-0 flex-col [&>*]:flex-1">
        <SightingHistoryPanel
          sightings={visibleSightings}
          totalCount={dossierSightings.length}
          query={sightingQuery}
          onQuery={(patch) => setSightingQuery((prev) => ({ ...prev, ...patch }))}
          onReset={() => setSightingQuery(defaultSightingQuery)}
          dirty={sightingQueryDirty}
          cameraOptions={cameraOptions}
          cityOptions={cityOptions}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          selectedId={evidenceId}
          onSelect={(sighting) => openEvidence(sighting.id)}
        />
      </div>

      <div
        className="responsive-band min-h-[340px] grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-[42fr_29fr_29fr]"
      >
        <div className="min-w-0">
          <RelatedEventsPanel
            events={events}
            plate={dossier.target.plate}
            onOpenEvent={() => navigate('/alerts')}
            onOpenEvidence={(id) => openEvidence(id)}
            onAcknowledge={(eventId) => {
              setAcknowledged((prev) => [...prev, eventId]);
              flash(`${eventId} acknowledged · removed from the unreviewed queue`);
            }}
          />
        </div>
        <div className="min-w-0">
          <RouteAnalysisPanel analysis={analysis} legs={legs} />
        </div>
        <div className="min-w-0">
          <RelatedVehiclesPanel
            associations={dossier.associations}
            cameraCount={analysis.camerasCrossed}
            onOpen={openAssociation}
            onAddToWatchlist={(association) => {
              setWatchlistOpen(true);
              flash(`Watchlist form opened for ${association.label}`);
            }}
          />
        </div>
      </div>

      <div className="flex min-h-[320px] shrink-0 flex-col [&>*]:flex-1">
        <EvidenceGalleryPanel
          evidence={evidence}
          totalCount={allEvidence.length}
          filter={evidenceFilter}
          onFilter={setEvidenceFilter}
          onOpen={(item) => openEvidence(item.sightingId)}
          onFullscreen={(item) => openEvidence(item.sightingId, true)}
          cameraOptions={cameraOptions}
        />
      </div>

      <div
        className="responsive-band min-h-[320px] grid shrink-0 grid-cols-1 gap-[var(--page-gap)] md:grid-cols-3 xl:grid-cols-[38fr_32fr_30fr]"
      >
        <div className="min-w-0">
          <SightingsOverTimePanel analytics={analytics} bucketLabel="5 min" />
        </div>
        <div className="min-w-0">
          <CameraFrequencyPanel
            analytics={analytics}
            activeCamera={sightingQuery.camera}
            onSelectCamera={(cameraId) =>
              setSightingQuery((prev) => ({ ...prev, camera: prev.camera === cameraId ? 'all' : cameraId }))
            }
          />
        </div>
        <div className="min-w-0">
          <LocationDistributionPanel analytics={analytics} />
        </div>
      </div>

      <InvestigationActionBar
        dossier={dossier}
        status={status}
        caseRef={caseRef}
        evidenceCount={evidence.length}
        lastCamera={lastSighting.cameraId}
        onTrackLive={() => {
          navigate('/camera-map');
          flash(`Live tracking handed to the GIS map · ${dossier.target.plate}`);
        }}
        onViewCamera={() => viewCamera(lastSighting.cameraId)}
        onAddToWatchlist={() => setWatchlistOpen(true)}
        onCreateCase={() => {
          setCaseToken((token) => token + 1);
          setCaseOpen(true);
        }}
        onExportEvidence={handleExportEvidence}
        onCloseInvestigation={handleCloseInvestigation}
        onReopen={() => {
          setStatus('active');
          flash(`${dossier.caseId} reopened · tracking resumed`);
        }}
      />

      <EvidenceViewerModal
        key={selectedSighting?.id ?? 'no-sighting'}
        sighting={selectedSighting}
        plate={dossier.target.plate}
        index={sightingIndex}
        total={scopedSightings.length}
        openFullscreen={fullscreenRequest}
        onClose={() => {
          setEvidenceId(null);
          setFullscreenRequest(false);
        }}
        onStep={stepEvidence}
        onViewCamera={viewCamera}
        onExportFrame={(sighting: VehicleSighting) => {
          flash(`${sighting.clip} · frame exported to the case bundle`);
        }}
      />

      <CreateCaseModal
        key={caseToken}
        open={caseOpen}
        dossier={dossier}
        evidence={evidence}
        suggestedRef={nextCaseRef(caseRef)}
        onClose={() => setCaseOpen(false)}
        onCreate={handleCreateCase}
      />

      <AddWatchlistModal
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        onCreate={(input) => {
          setWatchlistOpen(false);
          flash(`${input.label} added to ${input.categoryId === 'high-priority' ? 'High Priority Vehicles' : 'the watchlist'} · distribution within 60 s`);
        }}
      />

      {notice ? (
        <div className="fixed bottom-4 right-4 z-[80] animate-flash-in rounded-[6px] border border-accent-cyan/50 bg-[#083344] px-3 py-2 text-[12.5px] font-medium text-[#67e8f9] shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
