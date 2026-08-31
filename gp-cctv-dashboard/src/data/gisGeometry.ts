/**
 * GIS basemap geometry for the Camera Map workspace.
 *
 * Authored in a 1600 x 1000 "world" coordinate space that loosely mirrors the
 * Ahmedabad–Gandhinagar metropolitan region. Everything is projected to screen
 * space at render time (see useMapViewport), so swapping in real lat/lng tiles
 * later only means replacing `project()` with a Web-Mercator transform.
 */

export const WORLD_W = 1600;
export const WORLD_H = 1000;

export type RoadClass = 'expressway' | 'highway' | 'arterial' | 'secondary' | 'minor';

export interface RoadFeature {
  d: string;
  cls: RoadClass;
  name?: string;
  /** Label anchor + rotation along the road. */
  label?: { x: number; y: number; rotate: number };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Hydrology + green cover
 * ------------------------------------------------------------------ */

export const sabarmati =
  'M 742 -20 C 748 90, 706 170, 716 262 C 726 356, 668 404, 676 486 C 684 566, 626 616, 632 700 C 638 782, 586 828, 594 920 C 598 966, 586 1000, 582 1020';

export const riverfront =
  'M 700 300 C 708 380, 656 430, 662 512 C 668 590, 614 640, 620 720';

export const canals = [
  'M 1120 60 C 1180 160, 1240 220, 1360 260',
  'M 240 300 C 320 360, 360 430, 420 470',
];

export const lakes = [
  { cx: 706, cy: 792, rx: 26, ry: 20, name: 'Kankaria Lake' },
  { cx: 508, cy: 596, rx: 18, ry: 13, name: 'Vastrapur Lake' },
  { cx: 262, cy: 168, rx: 34, ry: 22, name: 'Thol Lake' },
  { cx: 1046, cy: 214, rx: 15, ry: 11, name: 'Sector 7 Lake' },
];

export const greenAreas = [
  'M 820 430 q 90 -46 168 -6 q 42 58 -26 96 q -122 34 -142 -90 Z',
  'M 380 700 q 78 -40 132 -4 q 22 52 -40 74 q -104 22 -92 -70 Z',
  'M 1180 420 q 96 -40 156 6 q 20 60 -58 78 q -122 12 -98 -84 Z',
  'M 560 220 q 70 -34 120 0 q 18 46 -44 62 q -96 12 -76 -62 Z',
  'M 940 760 q 84 -36 140 4 q 18 54 -52 72 q -110 14 -88 -76 Z',
];

/* ------------------------------------------------------------------ *
 * Road network
 * ------------------------------------------------------------------ */

export const roads: RoadFeature[] = [
  // ---- expressways -------------------------------------------------
  {
    d: 'M 700 700 L 840 760 L 1000 830 L 1180 900 L 1400 960 L 1620 1010',
    cls: 'expressway',
    name: 'NE-1 Expressway → Vadodara',
    label: { x: 1180, y: 884, rotate: 17 },
  },
  {
    d: 'M -20 880 L 180 838 L 360 792 L 520 736 L 664 676',
    cls: 'expressway',
    name: 'NH-48 → Rajkot',
    label: { x: 250, y: 806, rotate: -14 },
  },
  {
    d: 'M 676 600 L 782 520 L 884 442 L 980 366 L 1044 302',
    cls: 'expressway',
    name: 'NH-147 Ahmedabad–Gandhinagar',
    label: { x: 858, y: 452, rotate: -38 },
  },

  // ---- ring road ---------------------------------------------------
  {
    d: 'M 660 300 C 900 306, 1024 470, 1000 660 C 976 852, 800 946, 610 926 C 420 906, 300 760, 320 574 C 338 402, 470 296, 660 300 Z',
    cls: 'highway',
    name: 'Sardar Patel Ring Road',
    label: { x: 986, y: 700, rotate: 74 },
  },

  // ---- primary arterials ------------------------------------------
  {
    d: 'M 806 292 L 756 400 L 700 512 L 640 626 L 574 742 L 512 856',
    cls: 'highway',
    name: 'S.G. Highway',
    label: { x: 664, y: 580, rotate: 62 },
  },
  {
    d: 'M 690 372 L 686 470 L 678 566 L 672 664 L 666 762',
    cls: 'arterial',
    name: 'Ashram Road',
    label: { x: 682, y: 520, rotate: 87 },
  },
  {
    d: 'M 560 470 C 640 452, 720 460, 800 486',
    cls: 'arterial',
    name: 'Shahibaug Road',
    label: { x: 682, y: 452, rotate: -4 },
  },
  {
    d: 'M 520 520 C 600 506, 660 510, 700 524',
    cls: 'arterial',
    name: 'Naranpura Road',
    label: { x: 578, y: 500, rotate: -8 },
  },
  {
    d: 'M 606 566 L 700 588 L 786 606',
    cls: 'arterial',
    name: 'C.G. Road',
    label: { x: 690, y: 578, rotate: 8 },
  },
  {
    d: 'M 420 606 C 520 586, 620 592, 706 616 C 800 642, 872 690, 916 760',
    cls: 'arterial',
    name: '132 Ft Ring Road',
    label: { x: 520, y: 588, rotate: -6 },
  },
  {
    d: 'M 700 700 L 780 726 L 866 744 L 950 748',
    cls: 'arterial',
    name: 'Maninagar–Vatva Road',
    label: { x: 830, y: 728, rotate: 8 },
  },
  {
    d: 'M 980 366 L 1030 300 L 1064 240 L 1096 176',
    cls: 'arterial',
    name: 'Kudasan Road',
    label: { x: 1042, y: 276, rotate: -60 },
  },
  {
    d: 'M 1044 302 L 1132 336 L 1196 386',
    cls: 'arterial',
    name: 'GIFT City Road',
    label: { x: 1122, y: 322, rotate: 22 },
  },
  { d: 'M 806 292 L 852 202 L 892 118 L 918 40', cls: 'arterial', name: 'Kalol Road' },
  { d: 'M 320 574 L 210 540 L 90 520 L -20 512', cls: 'arterial', name: 'Sanand Road' },
  { d: 'M 1000 660 L 1120 636 L 1250 620 L 1400 604', cls: 'arterial', name: 'Dahegam Road' },
  { d: 'M 610 926 L 600 966 L 592 1010', cls: 'arterial' },
  { d: 'M 884 442 L 960 470 L 1040 484 L 1140 480', cls: 'arterial' },
  { d: 'M 470 296 L 430 200 L 386 110', cls: 'arterial' },

  // ---- secondaries -------------------------------------------------
  { d: 'M 560 470 L 520 380 L 486 300', cls: 'secondary' },
  { d: 'M 640 626 L 560 664 L 476 690', cls: 'secondary' },
  { d: 'M 700 512 L 786 540 L 866 566', cls: 'secondary' },
  { d: 'M 574 742 L 660 776 L 736 802', cls: 'secondary' },
  { d: 'M 916 760 L 960 830 L 986 900', cls: 'secondary' },
  { d: 'M 420 606 L 356 660 L 300 726', cls: 'secondary' },
  { d: 'M 806 292 L 900 320 L 980 366', cls: 'secondary' },
  { d: 'M 1196 386 L 1268 430 L 1330 490', cls: 'secondary' },
  { d: 'M 1096 176 L 1180 200 L 1264 236', cls: 'secondary' },
  { d: 'M 262 168 L 340 230 L 430 200', cls: 'secondary' },
  { d: 'M 180 838 L 240 760 L 300 726', cls: 'secondary' },
  { d: 'M 1000 830 L 1060 760 L 1120 700', cls: 'secondary' },
  { d: 'M 360 792 L 420 720 L 476 690', cls: 'secondary' },
  { d: 'M 1140 480 L 1210 520 L 1268 570', cls: 'secondary' },
];

/** Gandhinagar's signature sector grid (rotated slightly for realism). */
export const sectorGrid: string[] = (() => {
  const out: string[] = [];
  const originX = 940;
  const originY = 130;
  const cols = 7;
  const rows = 5;
  const step = 34;
  const skew = 0.16;

  for (let c = 0; c <= cols; c += 1) {
    const x = originX + c * step;
    out.push(`M ${x} ${originY} L ${x - rows * step * skew} ${originY + rows * step}`);
  }
  for (let r = 0; r <= rows; r += 1) {
    const y = originY + r * step;
    out.push(`M ${originX - r * step * skew} ${y} L ${originX + cols * step - r * step * skew} ${y}`);
  }
  return out;
})();

/** Railway corridors. */
export const railways = [
  'M 300 240 L 470 360 L 606 470 L 700 566 L 806 660 L 940 760 L 1080 860',
  'M 700 566 L 830 540 L 960 528 L 1100 530',
];

/** Airport runway (SVPI). */
export const runway = { x: 832, y: 402, w: 96, h: 9, rotate: -34 };

/* ------------------------------------------------------------------ *
 * Built-up texture
 * ------------------------------------------------------------------ */

export const urbanBlocks: Array<{ x: number; y: number; w: number; h: number; o: number }> = (() => {
  const rnd = mulberry32(90210);
  const blocks: Array<{ x: number; y: number; w: number; h: number; o: number }> = [];

  // Ahmedabad core
  for (let i = 0; i < 150; i += 1) {
    blocks.push({
      x: 360 + rnd() * 560,
      y: 420 + rnd() * 440,
      w: 10 + rnd() * 30,
      h: 8 + rnd() * 22,
      o: 0.05 + rnd() * 0.13,
    });
  }
  // Gandhinagar / GIFT
  for (let i = 0; i < 55; i += 1) {
    blocks.push({
      x: 900 + rnd() * 300,
      y: 130 + rnd() * 260,
      w: 8 + rnd() * 22,
      h: 7 + rnd() * 18,
      o: 0.05 + rnd() * 0.12,
    });
  }
  return blocks;
})();

/** Neighbourhood street mesh. */
export const minorStreets: string[] = (() => {
  const rnd = mulberry32(1357);
  const out: string[] = [];

  for (let i = 0; i < 130; i += 1) {
    const cx = 340 + rnd() * 620;
    const cy = 400 + rnd() * 480;
    const len = 24 + rnd() * 90;
    const ang = (rnd() < 0.5 ? 0.2 : 1.34) + (rnd() - 0.5) * 0.55;
    const x2 = cx + Math.cos(ang) * len;
    const y2 = cy + Math.sin(ang) * len;
    out.push(`M ${cx.toFixed(0)} ${cy.toFixed(0)} L ${x2.toFixed(0)} ${y2.toFixed(0)}`);
  }
  for (let i = 0; i < 70; i += 1) {
    const cx = rnd() * WORLD_W;
    const cy = rnd() * WORLD_H;
    if (cx > 340 && cx < 960 && cy > 400 && cy < 880) continue;
    const len = 40 + rnd() * 140;
    const ang = rnd() * Math.PI;
    out.push(
      `M ${cx.toFixed(0)} ${cy.toFixed(0)} L ${(cx + Math.cos(ang) * len).toFixed(0)} ${(cy + Math.sin(ang) * len).toFixed(0)}`,
    );
  }
  return out;
})();

/* ------------------------------------------------------------------ *
 * Place labels
 * ------------------------------------------------------------------ */

export interface PlaceLabel {
  text: string;
  x: number;
  y: number;
  kind: 'metro' | 'city' | 'town' | 'area' | 'poi';
}

export const places: PlaceLabel[] = [
  { text: 'AHMEDABAD', x: 596, y: 646, kind: 'metro' },
  { text: 'GANDHINAGAR', x: 1052, y: 128, kind: 'city' },
  { text: 'GIFT CITY', x: 1170, y: 348, kind: 'city' },

  { text: 'Shahibaug', x: 742, y: 470, kind: 'area' },
  { text: 'Naranpura', x: 546, y: 494, kind: 'area' },
  { text: 'Navrangpura', x: 646, y: 556, kind: 'area' },
  { text: 'Vastrapur', x: 500, y: 574, kind: 'area' },
  { text: 'Bodakdev', x: 528, y: 538, kind: 'area' },
  { text: 'Satellite', x: 556, y: 620, kind: 'area' },
  { text: 'Maninagar', x: 712, y: 736, kind: 'area' },
  { text: 'Vatva', x: 852, y: 792, kind: 'area' },
  { text: 'Naroda', x: 872, y: 522, kind: 'area' },
  { text: 'Nikol', x: 828, y: 636, kind: 'area' },
  { text: 'Chandkheda', x: 780, y: 372, kind: 'area' },
  { text: 'Motera', x: 716, y: 414, kind: 'area' },
  { text: 'Sabarmati', x: 660, y: 448, kind: 'area' },
  { text: 'Bopal', x: 436, y: 656, kind: 'area' },
  { text: 'Ghuma', x: 396, y: 704, kind: 'area' },
  { text: 'Sarkhej', x: 470, y: 774, kind: 'area' },
  { text: 'Kudasan', x: 986, y: 306, kind: 'area' },
  { text: 'Randesan', x: 1076, y: 268, kind: 'area' },
  { text: 'Adalaj', x: 896, y: 272, kind: 'area' },
  { text: 'Pethapur', x: 1146, y: 158, kind: 'area' },
  { text: 'Sector 21', x: 986, y: 176, kind: 'area' },
  { text: 'Infocity', x: 1108, y: 258, kind: 'area' },

  { text: 'Sanand', x: 148, y: 522, kind: 'town' },
  { text: 'Changodar', x: 268, y: 812, kind: 'town' },
  { text: 'Bavla', x: 108, y: 868, kind: 'town' },
  { text: 'Kalol', x: 902, y: 76, kind: 'town' },
  { text: 'Chiloda', x: 1268, y: 232, kind: 'town' },
  { text: 'Dahegam', x: 1394, y: 596, kind: 'town' },
  { text: 'Kolvada', x: 1300, y: 128, kind: 'town' },
  { text: 'Aslali', x: 936, y: 890, kind: 'town' },
  { text: 'Thol', x: 262, y: 130, kind: 'town' },

  { text: 'SVP Intl. Airport', x: 862, y: 388, kind: 'poi' },
  { text: 'Kankaria Lake', x: 706, y: 822, kind: 'poi' },
  { text: 'Sabarmati Riverfront', x: 646, y: 500, kind: 'poi' },
  { text: 'Vadodara →', x: 1508, y: 946, kind: 'poi' },
];
