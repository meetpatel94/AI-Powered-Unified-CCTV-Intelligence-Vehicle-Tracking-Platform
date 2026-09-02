import { Compass, Layers3, MapPin } from 'lucide-react';

import {
  LAYER_OPTIONS,
  MAP_CENTER_OPTIONS,
  NUMERIC_META_OF,
  SECTION_META,
} from '@/data/settingsData';

import {
  SectionPanel,
  SectionSubhead,
  SettingChips,
  SettingRow,
  SettingSelect,
  SettingSlider,
  SettingToggle,
  StateChip,
} from '@/components/settings/SettingPrimitives';

import type { GisMapsConfig, SettingValue } from '@/types/settings';

interface GisMapsSectionProps {
  cfg: GisMapsConfig;
  patch: (path: string, value: SettingValue) => void;
  pending: number;
}

const p = 'gis';

const layerLabel = (value: string) => LAYER_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Command-map viewport, layers and live overlays. */
export function GisMapsSection({ cfg, patch, pending }: GisMapsSectionProps) {
  const meta = SECTION_META.gis;
  return (
    <SectionPanel
      id="section-gis"
      icon={meta.icon}
      iconTileCls={meta.accentChip}
      iconCls={meta.iconColor}
      title={meta.label}
      blurb={meta.blurb}
      pendingChanges={pending}
      headerNote={<StateChip tone="cyan">topo base · offline-ready</StateChip>}
    >
      <SectionSubhead right="rendered by the camera-map module">
        <span className="flex items-center gap-1.5">
          <Compass size={11} />
          Viewport
        </span>
      </SectionSubhead>

      <SettingRow label="Default map center" hint="Where the command map opens after login and after 'Reset view'.">
        <SettingSelect
          ariaLabel="Default map center"
          value={cfg.mapCenter}
          onChange={(next) => patch(`${p}.mapCenter`, next)}
          options={MAP_CENTER_OPTIONS.map((label) => ({ value: label, label }))}
        />
      </SettingRow>

      <SettingRow
        label="Default zoom level"
        hint="Higher zoom shows corridor detail; lower zoom fits a whole district."
      >
        <SettingSlider
          ariaLabel="Default zoom level"
          value={cfg.zoomLevel}
          meta={NUMERIC_META_OF(`${p}.zoomLevel`)}
          onChange={(next) => patch(`${p}.zoomLevel`, next)}
          readout={zoomBand(cfg.zoomLevel)}
        />
      </SettingRow>

      <SettingRow label="Map layers" hint="Base and overlay layers available on the console map.">
        <SettingChips
          ariaLabel="Map layers"
          value={cfg.layers}
          onChange={(next) => patch(`${p}.layers`, next)}
          options={LAYER_OPTIONS}
        />
      </SettingRow>

      <SectionSubhead right="map engine · GP-Carto v2">
        <span className="flex items-center gap-1.5">
          <Layers3 size={11} />
          Markers & routes
        </span>
      </SectionSubhead>

      <SettingRow
        label="Camera marker clustering"
        hint="Groups nearby cameras into a count badge until the zoom reveals each one."
      >
        <SettingToggle
          checked={cfg.markerClustering}
          onChange={(next) => patch(`${p}.markerClustering`, next)}
          label="Camera marker clustering"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Journey route display"
        hint="Draw reconstructed vehicle routes across the network when a journey is selected."
      >
        <SettingToggle
          checked={cfg.routeDisplay}
          onChange={(next) => patch(`${p}.routeDisplay`, next)}
          label="Journey route display"
          caption
        />
      </SettingRow>

      <SettingRow
        label="Live vehicle tracking overlay"
        hint="Animated live position markers for tracked vehicles of interest."
      >
        <SettingToggle
          checked={cfg.liveVehicleTracking}
          onChange={(next) => patch(`${p}.liveVehicleTracking`, next)}
          label="Live vehicle tracking overlay"
          caption
        />
      </SettingRow>

      <SettingRow label="Track refresh interval" hint="Poll cadence for live overlay positions.">
        <div className={cfg.liveVehicleTracking ? '' : 'pointer-events-none opacity-40'}>
          <SettingSelect
            ariaLabel="Track refresh interval"
            value={cfg.trackRefreshSec}
            onChange={(next) => patch(`${p}.trackRefreshSec`, Number(next))}
            options={[
              { value: 1, label: 'Every 1 second' },
              { value: 2, label: 'Every 2 seconds' },
              { value: 5, label: 'Every 5 seconds' },
              { value: 10, label: 'Every 10 seconds' },
            ]}
          />
        </div>
      </SettingRow>

      <div className="flex items-center gap-2 border-t border-edge/40 pt-2.5 text-[11px] text-ink-faint">
        <MapPin size={12} className="shrink-0 text-[#5eead4]" />
        Active layers: <span className="text-[#c3cfe2]">{cfg.layers.map(layerLabel).join(' · ') || 'none'}</span> · camera markers:{' '}
        <span className="tnum text-[#c3cfe2]">12,842</span>
      </div>
    </SectionPanel>
  );
}

function zoomBand(zoom: number): string {
  if (zoom <= 6) return 'state view';
  if (zoom <= 9) return 'district view';
  if (zoom <= 13) return 'city view';
  if (zoom <= 15) return 'corridor view';
  return 'junction view';
}
