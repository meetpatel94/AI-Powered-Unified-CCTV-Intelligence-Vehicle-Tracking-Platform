/**
 * Single affine fit between the hand-authored GIS world (`data/gisGeometry.ts`,
 * 1600 × 1000) and the Ahmedabad–Gandhinagar belt. Anchors: C-001 Shahibaug
 * (world 742,486) and C-038 GIFT City (world 1148,352).
 *
 * Every screen that needs lat/lng for a camera goes through this one function,
 * so swapping the SVG world for real tiles means replacing this file with a
 * Web-Mercator projection and nothing else.
 */
const GEO_ORIGIN = { x: 742, y: 486, lat: 23.0438, lng: 72.5872 };
const GEO_SCALE = { lngPerPx: 0.00012266, latPerPx: -0.0011358 };

export function worldToLatLng(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: Number((GEO_ORIGIN.lat + (y - GEO_ORIGIN.y) * GEO_SCALE.latPerPx).toFixed(5)),
    lng: Number((GEO_ORIGIN.lng + (x - GEO_ORIGIN.x) * GEO_SCALE.lngPerPx).toFixed(5)),
  };
}
