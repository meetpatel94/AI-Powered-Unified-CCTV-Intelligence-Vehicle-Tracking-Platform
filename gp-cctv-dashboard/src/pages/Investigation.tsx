import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AddWatchlistModal } from '@/components/watchlist/AddWatchlistModal';
import { CrossCameraJourneyPanel } from '@/components/investigation/CrossCameraJourneyPanel';
import { CreateCaseModal, type NewCaseInput } from '@/components/investigation/CreateCaseModal';
import { EvidenceViewerModal } from '@/components/investigation/EvidenceViewerModal';
import { InvestigationActionBar } from '@/components/investigation/InvestigationActionBar';
import { InvestigationDetailsPanel } from '@/components/investigation/InvestigationDetailsPanel';
import { InvestigationHeader } from '@/components/investigation/InvestigationHeader';
import { RelatedEventsPanel } from '@/components/investigation/RelatedEventsPanel';
import { RelatedVehiclesPanel } from '@/components/investigation/RelatedVehiclesPanel';
import { RouteAnalysisPanel } from '@/components/investigation/RouteAnalysisPanel';
import { SightingHistoryPanel } from '@/components/investigation/SightingHistoryPanel';
import { TargetVehicleCard } from '@/components/investigation/TargetVehicleCard';
import {
  buildEvidence,
  buildRouteLegs,
  cameraOptionsOf,
  computeRouteAnalysis,
  defaultSightingQuery,
  dossierLegs,
  filterSightings,
  nextCaseRef,
  primaryRoute,
  sortSightings,
} from '@/data/investigationData';
import { formatClock, useLiveClock } from '@/hooks/useLiveClock';
import { useInvestigationDossier } from '@/hooks/useIntelligence';
import type {
  Association,
  InvestigationFilters,
  InvestigationStatus,
  RelatedEvent,
  SightingQuery,
  SightingSortDir,
  SightingSortKey,
  VehicleSighting,
  InvestigationDossier,
} from '@/types/investigation';

const defaultFilters: InvestigationFilters = {
  date: '2026-09-04',
  range: 'day',
  location: 'all',
  camera: 'all',
};

function emptyDossier(plate: string): InvestigationDossier {
  return {
    caseId: '—',
    title: plate ? `Backend dossier — ${plate}` : 'No vehicle selected',
    openedBy: 'Vehicle Intelligence Pipeline',
    openedAt: '—',
    unit: 'Real-Time ANPR Records',
    status: 'active',
    priority: 'low',
    target: {
      id: plate || 'none',
      plate: plate || '—',
      make: '—', model: '—', variant: '', label: 'No backend sightings', color: '—', year: 0,
      vehicleClass: '—', fuel: '—', registeredOwner: '—', registrationState: '—', insuranceExpiry: '—', fitnessExpiry: '—',
      snapshot: '', confidence: 0, meanConfidence: 0, status: 'lost',
      watchlist: { match: false, category: 'Not on watchlist', categoryId: 'none', priority: 'low', entryId: '', addedOn: '—', action: 'No standing instruction.' },
      attributes: [], history: [],
    },
    sightings: [],
    events: [],
    associations: [],
  };
}

/**
 * INVESTIGATION & VEHICLE INTELLIGENCE workspace. Reading order:
 *
 *   1. Target Vehicle + Investigation Details   (who / what state the case is in)
 *   2. Cross-Camera Vehicle Journey             (full-width route reconstruction)
 *   3. Sighting History                         (full-width ANPR read table)
 *   4. Related Events · Route Analysis · Related Vehicles
 *
 * The live dossier streams from `/api/investigation/{plate}/dossier` (real ANPR
 * sightings, alerts and watchlist context); mock dossiers render when the
 * backend is unreachable. Case filing POSTs `/api/investigation/cases`.
 */
export function Investigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clock = formatClock(useLiveClock());

  /* ---------------- target state ---------------- */
  const initialPlate = searchParams.get('plate')?.toUpperCase() ?? '';
  const [targetPlate, setTargetPlate] = useState(initialPlate);
  const [plate, setPlate] = useState(initialPlate);

  /* ---------------- workspace state ---------------- */
  const [filters, setFilters] = useState<InvestigationFilters>(defaultFilters);
  const [sightingQuery, setSightingQuery] = useState<SightingQuery>(defaultSightingQuery);
  const [includeReReads, setIncludeReReads] = useState(true);
  const [sortKey, setSortKey] = useState<SightingSortKey>('time');
  const [sortDir, setSortDir] = useState<SightingSortDir>('asc');
  const [activeStep, setActiveStep] = useState<number | null>(null);
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
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [fullscreenRequest, setFullscreenRequest] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  /* ---------------- deep link (from global search) ---------------- */
  const paramPlate = searchParams.get('plate');
  useEffect(() => {
    if (!paramPlate) return;
    const next = paramPlate.toUpperCase();
    setTargetPlate(next);
    setPlate(next);
    setStatus('active');
    setCaseRef(null);
    setAcknowledged([]);
    setSightingQuery(defaultSightingQuery);
    setActiveStep(null);
    setFrameToken((token) => token + 1);
    flash(`Dossier loaded for ${next}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramPlate]);

  const { dossier, live: dossierLive, createCase } = useInvestigationDossier(targetPlate, emptyDossier(targetPlate));

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
  const cameraOptions = useMemo(() => cameraOptionsOf(dossierSightings), [dossierSightings]);

  const events = useMemo<RelatedEvent[]>(
    () => dossier.events.map((event) => ({ ...event, acknowledged: event.acknowledged || acknowledged.includes(event.id) })),
    [dossier.events, acknowledged],
  );

  const evidence = useMemo(() => buildEvidence(scopedSightings), [scopedSightings]);

  /** Plate index used to resolve a header search that is not an exact plate. */
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

  const selectTarget = useCallback((nextPlate: string, message: string) => {
    setTargetPlate(nextPlate);
    setPlate(nextPlate);
    setStatus('active');
    setCaseRef(null);
    setAcknowledged([]);
    setSightingQuery(defaultSightingQuery);
    setActiveStep(null);
    setFrameToken((token) => token + 1);
    flash(message);
  }, [flash]);

  const handleSearch = () => {
    const value = plate.trim().toUpperCase();
    if (value) selectTarget(value, `Dossier loaded · ${value} · backend ANPR reconstruction`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 800);
    flash(
      `Investigation re-synced · ${dossierSightings.length} sightings · ${analysis.camerasCrossed} cameras · ${events.length} linked events`,
    );
  };

  const handleExportCase = () => {
    const bundle = { dossier, status, exportedAt: clock, evidenceIds: evidence.map((item) => item.id) };
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

  const handleCreateCase = (input: NewCaseInput) => {
    const ref = nextCaseRef(caseRef);
    setCaseRef(ref);
    setStatus('escalated');
    setCaseOpen(false);
    if (dossierLive) {
      // Real filing: POST /api/investigation/cases (evidence ids are numeric).
      void createCase({
        subject_plate: dossier.target.plate,
        title: input.title,
        priority: input.priority,
        notes: [input.offence, input.fir ? `FIR ${input.fir}` : null, input.notes].filter(Boolean).join(' · '),
        officer: input.officer || null,
        evidence_ids: input.evidenceIds.map(Number).filter((id) => Number.isFinite(id)),
      })
        .then((created) =>
          flash(
            `${created.case_number} filed · ${input.priority} priority · ${created.evidence_ids.length} evidence frames attached`,
          ),
        )
        .catch(() => flash(`${ref} saved locally — case service unreachable`));
      return;
    }
    flash(`${ref} created · ${input.priority} priority · ${input.evidenceIds.length} evidence frames attached`);
  };

  const handleCloseInvestigation = () => {
    setStatus('closed');
    setPlaying(false);
    flash(`${dossier.caseId} closed and archived · ${evidence.length} frames retained for 90 days`);
  };

  const handleNewInvestigation = () => {
    setPlate('');
    setFilters(defaultFilters);
    setSightingQuery(defaultSightingQuery);
    setCaseRef(null);
    setStatus('active');
    setPlaying(false);
    flash('New investigation opened · enter a plate to begin the reconstruction');
  };


  const openEvidence = (id: string) => {
    setEvidenceId(id);
    setFrameToken((token) => token + 1);
  };

  const handleStep = (step: number) => {
    setActiveStep(step);
    const sighting = nodes.find((node) => node.journeyStep === step);
    if (sighting) openEvidence(sighting.id);
  };

  const handleTrackLive = () => {
    setPlaying(true);
    flash(`Live backend tracking view opened for ${dossier.target.plate}`);
  };

  const stepEvidence = (direction: 1 | -1) => {
    if (!scopedSightings.length) return;
    const index = Math.max(0, scopedSightings.findIndex((sighting) => sighting.id === evidenceId));
    const next = scopedSightings[(index + direction + scopedSightings.length) % scopedSightings.length];
    if (next) openEvidence(next.id);
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

  const associations = dossier.associations;

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

      {/* 1 — TARGET VEHICLE + INVESTIGATION DETAILS */}
      <div className="grid min-h-[300px] min-w-0 shrink-0 grid-cols-1 items-stretch gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_356px]">
        <TargetVehicleCard
          dossier={dossier}
          onOpenEvidence={(id) => openEvidence(id)}
          onViewCamera={viewCamera}
          onOpenWatchlist={() => navigate('/watchlist')}
        />
        <InvestigationDetailsPanel
          dossier={dossier}
          status={status}
          caseRef={caseRef}
          lastSync={clock}
          onEscalate={() => {
            setStatus('escalated');
            flash(`${dossier.caseId} escalated to the control-room duty officer`);
          }}
        />
      </div>

      {/* 2 — CROSS-CAMERA VEHICLE JOURNEY (full width) */}
      <CrossCameraJourneyPanel
        dossier={dossier}
        legs={legs}
        nodes={nodes}
        activeStep={activeStep}
        onSelectStep={handleStep}
        onOpenEvidence={(id) => openEvidence(id)}
        onViewCamera={viewCamera}
        onTrackLive={handleTrackLive}
        analysis={analysis}
        frameToken={frameToken}
        playing={playing}
        onToggleReplay={() => setPlaying((value) => !value)}
      />

      {/* 3 — SIGHTING HISTORY (full width) */}
      <div className="flex min-h-[440px] min-w-0 shrink-0 flex-col [&>*]:min-h-0 [&>*]:flex-1">
        <SightingHistoryPanel
          sightings={visibleSightings}
          totalCount={dossierSightings.length}
          query={sightingQuery}
          onQuery={(patch) => setSightingQuery((prev) => ({ ...prev, ...patch }))}
          onReset={() => setSightingQuery(defaultSightingQuery)}
          dirty={sightingQueryDirty}
          cameraOptions={cameraOptions}
          includeReReads={includeReReads}
          onIncludeReReads={setIncludeReReads}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          selectedId={evidenceId}
          onSelect={(sighting) => openEvidence(sighting.id)}
        />
      </div>

      {/* 4 — RELATED EVENTS · ROUTE ANALYSIS · RELATED VEHICLES */}
      <div className="grid min-h-[440px] min-w-0 shrink-0 grid-cols-1 items-stretch gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RelatedEventsPanel
          events={events}
          onOpenEvent={() => navigate('/alerts')}
          onOpenEvidence={(id) => openEvidence(id)}
          onAcknowledge={(eventId) => {
            setAcknowledged((prev) => [...prev, eventId]);
            flash(`${eventId} acknowledged · removed from the unreviewed queue`);
          }}
        />
        <div
          className={`grid min-w-0 gap-[var(--page-gap)] ${
            associations.length > 0 ? 'grid-rows-[minmax(0,auto)_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]'
          }`}
        >
          <RouteAnalysisPanel analysis={analysis} legs={legs} />
          {associations.length > 0 ? (
            <RelatedVehiclesPanel
              associations={associations}
              cameraCount={analysis.camerasCrossed}
              onOpen={openAssociation}
              onAddToWatchlist={(association) => {
                setWatchlistOpen(true);
                flash(`Watchlist form opened for ${association.label}`);
              }}
            />
          ) : null}
        </div>
      </div>

      <InvestigationActionBar
        dossier={dossier}
        status={status}
        caseRef={caseRef}
        evidenceCount={evidence.length}
        lastCamera={lastSighting?.cameraId ?? '—'}
        onTrackLive={handleTrackLive}
        onViewCamera={() => { if (lastSighting) viewCamera(lastSighting.cameraId); }}
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
