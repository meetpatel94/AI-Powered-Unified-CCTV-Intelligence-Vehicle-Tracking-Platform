import type { ReactNode } from 'react';
import { Layers, Locate, Map as MapIcon, Maximize, Minus, Plus, Satellite } from 'lucide-react';

import type { BaseMapStyle } from '@/components/cameramap/BaseMap';
import type { MapLayerState } from '@/types/cameraMap';

interface MapControlsProps {
  style: BaseMapStyle;
  onStyleChange: (style: BaseMapStyle) => void;
  layers: MapLayerState;
  onLayerToggle: (key: keyof MapLayerState) => void;
  layerMenuOpen: boolean;
  onLayerMenuToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  onFullscreen: () => void;
  zoomLevel: number;
  /** Right offset in px so the stack clears the intelligence panel. */
  rightOffset: number;
}

function ControlButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-[28px] w-[28px] place-items-center transition-colors ${
        active ? 'bg-[#1d6ce0] text-white' : 'bg-[#0b1526]/92 text-[#a6b8d4] hover:bg-[#152340] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

const layerLabels: Array<{ key: keyof MapLayerState; label: string }> = [
  { key: 'cameras', label: 'Camera markers' },
  { key: 'clusters', label: 'Marker clustering' },
  { key: 'alerts', label: 'Alert callouts' },
  { key: 'route', label: 'Vehicle route' },
  { key: 'labels', label: 'Place labels' },
  { key: 'heat', label: 'Coverage heatmap' },
];

/** Floating zoom / locate / layer / basemap / fullscreen stack. */
export function MapControls({
  style,
  onStyleChange,
  layers,
  onLayerToggle,
  layerMenuOpen,
  onLayerMenuToggle,
  onZoomIn,
  onZoomOut,
  onLocate,
  onFullscreen,
  zoomLevel,
  rightOffset,
}: MapControlsProps) {
  return (
    <div
      className="absolute top-3 z-30 flex flex-col items-end gap-2 transition-all"
      style={{ right: rightOffset }}
    >
      <div className="flex flex-col divide-y divide-edge overflow-hidden rounded-[5px] border border-edge backdrop-blur-sm">
        <ControlButton label="Zoom in" onClick={onZoomIn}>
          <Plus size={14} strokeWidth={2.4} />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={onZoomOut}>
          <Minus size={14} strokeWidth={2.4} />
        </ControlButton>
        <ControlButton label="Center on Ahmedabad" onClick={onLocate}>
          <Locate size={13} strokeWidth={2.1} />
        </ControlButton>
      </div>

      <div className="flex flex-col divide-y divide-edge overflow-hidden rounded-[5px] border border-edge backdrop-blur-sm">
        <ControlButton
          label="Road view"
          active={style === 'road'}
          onClick={() => onStyleChange('road')}
        >
          <MapIcon size={13} strokeWidth={2.1} />
        </ControlButton>
        <ControlButton
          label="Satellite view"
          active={style === 'satellite'}
          onClick={() => onStyleChange('satellite')}
        >
          <Satellite size={13} strokeWidth={2.1} />
        </ControlButton>
      </div>

      <div className="relative">
        <div className="flex flex-col divide-y divide-edge overflow-hidden rounded-[5px] border border-edge backdrop-blur-sm">
          <ControlButton label="Map layers" active={layerMenuOpen} onClick={onLayerMenuToggle}>
            <Layers size={13} strokeWidth={2.1} />
          </ControlButton>
          <ControlButton label="Fullscreen map" onClick={onFullscreen}>
            <Maximize size={13} strokeWidth={2.1} />
          </ControlButton>
        </div>

        {layerMenuOpen && (
          <div className="absolute right-[34px] top-0 w-[164px] rounded-md border border-edge bg-[#0a1220]/97 p-2 shadow-panel backdrop-blur-sm">
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
              Map Layers
            </div>
            <ul className="space-y-1">
              {layerLabels.map((layer) => (
                <li key={layer.key}>
                  <button
                    type="button"
                    onClick={() => onLayerToggle(layer.key)}
                    className="flex w-full items-center justify-between gap-2 rounded-[3px] px-1 py-[3px] text-[10px] text-[#c3cfe2] transition-colors hover:bg-panel-hover"
                  >
                    {layer.label}
                    <span
                      className={`relative h-[12px] w-[22px] rounded-full transition-colors ${
                        layers[layer.key] ? 'bg-accent-blue' : 'bg-[#22314b]'
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] h-[8px] w-[8px] rounded-full bg-white transition-all ${
                          layers[layer.key] ? 'left-[12px]' : 'left-[2px]'
                        }`}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="tnum rounded-[4px] border border-edge bg-[#0b1526]/92 px-1.5 py-[3px] text-[9px] text-[#8ea3c4] backdrop-blur-sm">
        {zoomLevel.toFixed(1)}x
      </div>
    </div>
  );
}
