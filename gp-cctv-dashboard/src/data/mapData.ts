import type { MapCamera, MapLabel, RoutePoint } from '@/types';

/**
 * Geometry for the GIS camera map.
 *
 * Everything is authored inside a 1000 x 700 SVG viewBox so the map scales
 * cleanly inside its panel. When a real tile provider (MapLibre / Leaflet +
 * Bhuvan or OSM raster) is wired in, this module is the only thing that has to
 * be swapped: markers/routes already carry camera ids.
 */

export const MAP_W = 1000;
export const MAP_H = 700;

/** Deterministic PRNG so the "city" never re-shuffles between renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- *
 * Rivers / green belts
 * ---------------------------------------------------------------- */

export const riverPath =
  'M 452 -20 C 462 90, 430 150, 445 235 C 458 312, 415 360, 428 442 C 440 520, 402 580, 418 720';

export const greenAreas = [
  'M 250 470 q 60 -40 120 -8 q 30 42 -18 70 q -84 26 -102 -62 Z',
  'M 690 520 q 70 -30 104 10 q 14 44 -46 54 q -70 4 -58 -64 Z',
  'M 150 210 q 54 -30 92 4 q 12 40 -40 50 q -62 2 -52 -54 Z',
];

/* ---------------------------------------------------------------- *
 * Road network
 * ---------------------------------------------------------------- */

/** Expressways / national highways — brightest, warm-tinted. */
export const highways = [
  // NH-48 running north-east to south-west through the metro
  'M -20 612 L 180 560 L 330 500 L 470 430 L 596 360 L 720 300 L 860 214 L 1020 150',
  // Ahmedabad – Gandhinagar corridor
  'M 430 470 L 500 400 L 566 330 L 636 262 L 700 196 L 748 132',
  // Eastern ring / bypass
  'M 636 262 L 742 300 L 812 372 L 852 470 L 838 570 L 780 660',
];

/** Arterial roads — S.G. Highway, ring road, radials. */
export const arterials = [
  // Ring road around the core
  'M 430 250 C 560 236, 660 320, 648 440 C 636 556, 520 620, 400 596 C 282 572, 224 470, 254 366 C 278 286, 344 258, 430 250 Z',
  // S.G. Highway
  'M 292 196 L 308 300 L 318 402 L 330 508 L 344 610',
  // 132ft ring
  'M 250 430 C 330 372, 452 366, 540 424',
  // Radials from the core
  'M 448 424 L 300 340',
  'M 448 424 L 372 566',
  'M 448 424 L 596 470',
  'M 448 424 L 540 300',
  'M 448 424 L 250 470',
  // Kalol / Adalaj link
  'M 566 330 L 520 220 L 470 130',
  // Dahegam link
  'M 812 372 L 906 330 L 980 300',
  // Sanand – Bavla
  'M 254 470 L 180 560 L 150 650',
  'M 330 508 L 250 596 L 210 680',
  // GIFT City access
  'M 700 196 L 776 232 L 820 290',
];

/** Secondary roads — thinner, cooler. */
export const secondaries = [
  'M 360 300 L 470 268 L 566 300',
  'M 320 402 L 430 380 L 540 424',
  'M 344 610 L 440 580 L 540 596 L 640 560',
  'M 596 470 L 660 520 L 720 560',
  'M 470 130 L 596 160 L 700 196',
  'M 250 366 L 160 330 L 60 340',
  'M 254 470 L 150 500 L 40 520',
  'M 648 440 L 742 420 L 812 372',
  'M 400 596 L 380 680',
  'M 540 300 L 620 250',
  'M 776 232 L 850 190 L 940 176',
  'M 906 330 L 930 420 L 900 500',
  'M 60 130 L 180 170 L 292 196',
  'M 860 214 L 930 250',
];

/** Dense minor street mesh, generated once with a fixed seed. */
export const minorStreets: string[] = (() => {
  const rnd = mulberry32(20260831);
  const out: string[] = [];

  // Dense urban grid over the Ahmedabad core
  for (let i = 0; i < 46; i += 1) {
    const cx = 230 + rnd() * 440;
    const cy = 250 + rnd() * 380;
    const len = 26 + rnd() * 80;
    const ang = (rnd() < 0.5 ? 0.18 : 1.36) + (rnd() - 0.5) * 0.5;
    const x2 = cx + Math.cos(ang) * len;
    const y2 = cy + Math.sin(ang) * len;
    const bend = (rnd() - 0.5) * 22;
    out.push(`M ${cx.toFixed(0)} ${cy.toFixed(0)} Q ${((cx + x2) / 2 + bend).toFixed(0)} ${((cy + y2) / 2 - bend).toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}`);
  }

  // Sparser rural lanes on the outskirts
  for (let i = 0; i < 52; i += 1) {
    const cx = rnd() * MAP_W;
    const cy = rnd() * MAP_H;
    if (cx > 230 && cx < 680 && cy > 250 && cy < 630) continue;
    const len = 40 + rnd() * 130;
    const ang = rnd() * Math.PI;
    out.push(
      `M ${cx.toFixed(0)} ${cy.toFixed(0)} L ${(cx + Math.cos(ang) * len).toFixed(0)} ${(cy + Math.sin(ang) * len).toFixed(0)}`,
    );
  }

  return out;
})();

/** Built-up blocks that give the core its "city" texture. */
export const urbanBlocks: Array<{ x: number; y: number; w: number; h: number; o: number }> = (() => {
  const rnd = mulberry32(4711);
  const blocks = [];
  for (let i = 0; i < 46; i += 1) {
    const x = 236 + rnd() * 420;
    const y = 262 + rnd() * 350;
    blocks.push({
      x,
      y,
      w: 12 + rnd() * 34,
      h: 10 + rnd() * 26,
      o: 0.05 + rnd() * 0.12,
    });
  }
  return blocks;
})();

/* ---------------------------------------------------------------- *
 * Labels
 * ---------------------------------------------------------------- */

export const mapLabels: MapLabel[] = [
  { text: 'Ahmedabad', x: 440, y: 492, size: 'city' },
  { text: 'GIFT City', x: 452, y: 344, size: 'area' },
  { text: 'Gandhinagar', x: 690, y: 118, size: 'town' },
  { text: 'Kalol', x: 452, y: 96, size: 'town' },
  { text: 'Kudasan', x: 616, y: 62, size: 'town' },
  { text: 'Adalaj', x: 512, y: 186, size: 'town' },
  { text: 'Dahegam', x: 938, y: 128, size: 'town' },
  { text: 'Rakhial', x: 880, y: 646, size: 'town' },
  { text: 'Kolvada', x: 838, y: 496, size: 'town' },
  { text: 'Naroda', x: 668, y: 336, size: 'town' },
  { text: 'Bopal', x: 240, y: 296, size: 'town' },
  { text: 'Bopal', x: 296, y: 442, size: 'area' },
  { text: 'Sanand', x: 170, y: 512, size: 'town' },
  { text: 'Changodar', x: 212, y: 606, size: 'town' },
  { text: 'Bavla', x: 300, y: 666, size: 'town' },
  { text: 'Maninagar', x: 606, y: 590, size: 'area' },
  { text: 'S.G. Highway', x: 306, y: 372, size: 'road', rotate: 84 },
  { text: 'NH-48', x: 208, y: 552, size: 'road', rotate: -20 },
  { text: 'Sardar Patel Ring Rd', x: 616, y: 494, size: 'road', rotate: 40 },
  { text: 'Ashram Road', x: 452, y: 418, size: 'road', rotate: 74 },
];

/* ---------------------------------------------------------------- *
 * Markers
 * ---------------------------------------------------------------- */

export const mapCameras: MapCamera[] = [
  { id: 'C-004', x: 468, y: 146, state: 'online' },
  { id: 'C-011', x: 456, y: 252, state: 'online' },
  { id: 'C-022', x: 336, y: 400, state: 'online' },
  { id: 'C-046', x: 262, y: 466, state: 'online' },
  { id: 'C-052', x: 352, y: 552, state: 'online' },
  { id: 'C-061', x: 486, y: 568, state: 'online' },
  { id: 'C-070', x: 616, y: 640, state: 'online' },
  { id: 'C-077', x: 720, y: 560, state: 'online' },
  { id: 'C-084', x: 782, y: 462, state: 'online' },
  { id: 'C-093', x: 880, y: 372, state: 'online' },
  { id: 'C-102', x: 812, y: 168, state: 'online' },
  { id: 'C-089', x: 548, y: 626, state: 'warning' },
];

export const routePoints: RoutePoint[] = [
  { step: 1, x: 286, y: 336, cameraCode: 'C-001' },
  { step: 2, x: 388, y: 300, cameraCode: 'C-007' },
  { step: 3, x: 536, y: 278, cameraCode: 'C-015' },
  { step: 4, x: 718, y: 172, cameraCode: 'C-038', critical: true },
];

/** Interception marker between stop 3 and 4 (speed violation on the corridor). */
export const criticalMarker = { x: 620, y: 226, id: 'C-115' };

export const routePath = 'M 286 336 L 388 300 L 536 278 L 620 226 L 718 172';
