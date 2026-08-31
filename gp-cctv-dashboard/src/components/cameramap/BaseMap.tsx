import {
  WORLD_H,
  WORLD_W,
  canals,
  greenAreas,
  lakes,
  minorStreets,
  railways,
  riverfront,
  roads,
  runway,
  sabarmati,
  sectorGrid,
  urbanBlocks,
} from '@/data/gisGeometry';
import type { RoadClass } from '@/data/gisGeometry';

export type BaseMapStyle = 'road' | 'satellite';

const roadStyle: Record<
  RoadClass,
  { casing: number; core: number; casingColor: string; coreColor: string }
> = {
  expressway: { casing: 7, core: 2.6, casingColor: '#6b5320', coreColor: '#e0a940' },
  highway: { casing: 5, core: 1.8, casingColor: '#4a3b1e', coreColor: '#b58f43' },
  arterial: { casing: 4.2, core: 1.6, casingColor: '#24507c', coreColor: '#4d86c4' },
  secondary: { casing: 2.6, core: 1, casingColor: '#1e4062', coreColor: '#37699c' },
  minor: { casing: 1.3, core: 0, casingColor: '#16324f', coreColor: 'transparent' },
};

const satelliteRoadStyle: Record<RoadClass, { casing: number; core: number; casingColor: string; coreColor: string }> = {
  expressway: { casing: 7, core: 2.6, casingColor: '#3d3628', coreColor: '#f0cf8a' },
  highway: { casing: 5.4, core: 2, casingColor: '#37331f', coreColor: '#d8d29a' },
  arterial: { casing: 4.2, core: 1.6, casingColor: '#2f2d26', coreColor: '#b9b6a6' },
  secondary: { casing: 2.6, core: 1, casingColor: '#2a2822', coreColor: '#8f8d80' },
  minor: { casing: 1.3, core: 0, casingColor: '#262622', coreColor: 'transparent' },
};

/**
 * The static GIS basemap: hydrology, green cover, road hierarchy, railways,
 * the Gandhinagar sector grid and built-up texture. Rendered once inside the
 * transformed layer so pan/zoom is a single CSS transform.
 */
export function BaseMap({ style }: { style: BaseMapStyle }) {
  const satellite = style === 'satellite';
  const rs = satellite ? satelliteRoadStyle : roadStyle;

  return (
    <svg
      width={WORLD_W + 1200}
      height={WORLD_H + 900}
      viewBox={`-600 -450 ${WORLD_W + 1200} ${WORLD_H + 900}`}
      className="pointer-events-none absolute select-none"
      style={{ left: -600, top: -450 }}
    >
      <defs>
        <radialGradient id="cm-core-glow" cx="42%" cy="62%" r="46%">
          <stop offset="0%" stopColor={satellite ? '#3a3a2e' : '#123255'} stopOpacity="0.85" />
          <stop offset="100%" stopColor={satellite ? '#1b1c16' : '#061224'} stopOpacity="0" />
        </radialGradient>
        <pattern id="cm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke={satellite ? '#2a2c22' : '#0d2038'}
            strokeWidth="0.5"
          />
        </pattern>
        <filter id="cm-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ground */}
      <rect x={-600} y={-450} width={WORLD_W + 1200} height={WORLD_H + 900} fill={satellite ? '#1b1c16' : '#061224'} />
      <rect
        x={-600}
        y={-450}
        width={WORLD_W + 1200}
        height={WORLD_H + 900}
        fill="url(#cm-grid)"
        opacity={satellite ? 0.5 : 0.6}
      />
      <rect width={WORLD_W} height={WORLD_H} fill="url(#cm-core-glow)" />

      {/* green cover */}
      {greenAreas.map((d, i) => (
        <path key={`g-${i}`} d={d} fill={satellite ? '#2f3a22' : '#0e2b23'} opacity={satellite ? 0.9 : 0.75} />
      ))}

      {/* lakes */}
      {lakes.map((lake) => (
        <ellipse
          key={lake.name}
          cx={lake.cx}
          cy={lake.cy}
          rx={lake.rx}
          ry={lake.ry}
          fill={satellite ? '#22384a' : '#123a5e'}
          stroke={satellite ? '#31576f' : '#1b5580'}
          strokeWidth="1"
        />
      ))}

      {/* rivers + canals */}
      <path
        d={sabarmati}
        fill="none"
        stroke={satellite ? '#22384a' : '#123a5e'}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d={sabarmati}
        fill="none"
        stroke={satellite ? '#31576f' : '#1b5580'}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path d={riverfront} fill="none" stroke={satellite ? '#3c5a3a' : '#14405f'} strokeWidth="2" opacity="0.7" />
      {canals.map((d, i) => (
        <path key={`c-${i}`} d={d} fill="none" stroke={satellite ? '#2b4657' : '#11314e'} strokeWidth="2.5" />
      ))}

      {/* built-up blocks */}
      {urbanBlocks.map((b, i) => (
        <rect
          key={`b-${i}`}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="1.5"
          fill={satellite ? '#8f8b78' : '#9dc0ee'}
          opacity={satellite ? b.o * 1.5 : b.o}
        />
      ))}

      {/* minor streets */}
      {minorStreets.map((d, i) => (
        <path
          key={`m-${i}`}
          d={d}
          fill="none"
          stroke={rs.minor.casingColor}
          strokeWidth={rs.minor.casing}
          strokeLinecap="round"
        />
      ))}

      {/* Gandhinagar sector grid */}
      {sectorGrid.map((d, i) => (
        <path
          key={`s-${i}`}
          d={d}
          fill="none"
          stroke={satellite ? '#5a5a4a' : '#1f4266'}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}

      {/* railways */}
      {railways.map((d, i) => (
        <g key={`r-${i}`}>
          <path d={d} fill="none" stroke={satellite ? '#57534e' : '#2b3b52'} strokeWidth="2.4" />
          <path
            d={d}
            fill="none"
            stroke={satellite ? '#a8a29e' : '#5b799a'}
            strokeWidth="1"
            strokeDasharray="6 6"
          />
        </g>
      ))}

      {/* airport runway */}
      <g transform={`rotate(${runway.rotate} ${runway.x} ${runway.y})`}>
        <rect
          x={runway.x - runway.w / 2}
          y={runway.y - runway.h / 2}
          width={runway.w}
          height={runway.h}
          rx="1"
          fill={satellite ? '#57534e' : '#22364f'}
          stroke={satellite ? '#a8a29e' : '#3c577a'}
          strokeWidth="0.7"
        />
      </g>

      {/* roads: casing then core */}
      {roads.map((road, i) => (
        <path
          key={`rc-${i}`}
          d={road.d}
          fill="none"
          stroke={rs[road.cls].casingColor}
          strokeWidth={rs[road.cls].casing}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {roads.map((road, i) =>
        rs[road.cls].core ? (
          <path
            key={`rk-${i}`}
            d={road.d}
            fill="none"
            stroke={rs[road.cls].coreColor}
            strokeWidth={rs[road.cls].core}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        ) : null,
      )}
    </svg>
  );
}
