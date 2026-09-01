/** Shared chart helpers for the analytics workspace (SVG series + IN formatting). */

export function formatIn(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface PlotPoint {
  x: number;
  y: number;
}

export function seriesToPoints(values: number[], max: number): PlotPoint[] {
  const n = Math.max(1, values.length - 1);
  const denom = Math.max(1, max);
  return values.map((value, index) => ({
    x: (index / n) * 100,
    y: 100 - (value / denom) * 100,
  }));
}

export function toLine(points: PlotPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function toArea(points: PlotPoint[]): string {
  if (points.length === 0) return '0,100 100,100';
  return `0,100 ${toLine(points)} 100,100`;
}

/** Largest-remainder so integer parts always sum to `total`. */
export function distribute(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((acc, weight) => acc + weight, 0) || 1;
  const raw = weights.map((weight) => (weight / sum) * total);
  const rounded = raw.map((value) => Math.floor(value));
  let remain = total - rounded.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remain; i += 1) {
    rounded[order[i % order.length].index] += 1;
  }
  return rounded;
}

export function peakOf(points: Array<{ label: string; value: number }>): { label: string; value: number } {
  if (points.length === 0) return { label: '—', value: 0 };
  return points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
}
