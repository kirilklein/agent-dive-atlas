/** The same small statistics as companion/checkpoint_4.py and compare.py. */

/** Two-sided 95% critical values of Student's t, by degrees of freedom. */
const T95: Record<number, number> = {
  1: 12.71, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 15: 2.13, 20: 2.09, 30: 2.04,
};

export function t95(df: number): number {
  if (T95[df]) return T95[df];
  const k = Object.keys(T95).map(Number).sort((a, b) => a - b).find((x) => x >= df);
  return k ? T95[k] : 1.96;
}

/** 95% Wilson interval for k successes out of n. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [centre - half, centre + half];
}

export type Paired = { mean: number; sd: number; lo: number; hi: number; needed: number };

/** Mean paired difference, its 95% t-interval, and the sample size at which a
 * z-interval of the same spread would exclude zero. */
export function paired(diffs: number[]): Paired {
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1));
  const half = (t95(n - 1) * sd) / Math.sqrt(n);
  const needed = mean ? Math.ceil(((1.96 * sd) / Math.abs(mean)) ** 2) : Infinity;
  return { mean, sd, lo: mean - half, hi: mean + half, needed };
}

/** Interval half-width for a mean of n paired differences with spread sd. */
export function halfWidth(sd: number, n: number): number {
  return (t95(n - 1) * sd) / Math.sqrt(n);
}

export const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');

export function compact(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}K`;
  return `${Math.round(v)}`;
}

/** Clean axis ticks from 0 to at least max. */
export function niceTicks(max: number, count = 4): number[] {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
