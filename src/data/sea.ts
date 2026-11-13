/**
 * The sea behind the dive line, as a side-view cross-section in world units.
 * World y is depth: the surface sits at SURFACE_Y and the trench floor near SEABED_Y.
 */

export const SURFACE_Y = 40;
export const SEABED_Y = 955;

/** World y → metres, stretched so each station sits in its real ocean zone. */
const SCALE: [y: number, metres: number][] = [
  [SURFACE_Y, 0],
  [300, 200],
  [500, 1000],
  [720, 4000],
  [SEABED_Y, 6000],
];

function yAtDepth(m: number): number {
  const i = Math.max(1, SCALE.findIndex(([, d]) => d >= m));
  const [y0, d0] = SCALE[i - 1];
  const [y1, d1] = SCALE[i];
  return y0 + ((m - d0) / (d1 - d0)) * (y1 - y0);
}

const ZONES: Record<number, string> = { 200: 'twilight', 1000: 'midnight', 4000: 'abyss' };

export type DepthLine = { y: number; label: string; index: boolean };

export const DEPTH_LINES: DepthLine[] = [100, 200, 500, 1000, 2000, 3000, 4000, 5000].map((m) => ({
  y: yAtDepth(m),
  label: `${m.toLocaleString('en-US')} m${ZONES[m] ? ` · ${ZONES[m]}` : ''}`,
  index: m in ZONES,
}));

/** Extra lines for close-up views. */
export const FINE_DEPTH_YS: number[] = [50, 150, 300, 400, 600, 700, 800, 900, 1500, 2500, 3500, 4500, 5500].map(yAtDepth);

type P = [x: number, y: number];

/** A rounded path through the midpoints of a hand-placed polyline. */
function smooth(pts: P[]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q ${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [ex, ey] = pts[pts.length - 1];
  return `${d} L ${ex} ${ey}`;
}

const CAVE: P[] = [
  [138, 468],
  [95, 482],
  [40, 497],
  [15, 532],
  [40, 568],
  [100, 580],
  [152, 594],
];

/** The water: down the left wall (past the cave), along the trench floor, up the right wall (wreck shelf, reef ledge). */
const BASIN: P[] = [
  [-2600, SURFACE_Y],
  [-600, 50],
  [-200, 80],
  [-40, 140],
  [50, 220],
  [100, 320],
  [125, 410],
  ...CAVE,
  [165, 660],
  [190, 740],
  [240, 830],
  [320, 900],
  [420, 942],
  [520, 953],
  [620, 947],
  [700, 930],
  [780, 900],
  [840, 850],
  [868, 810],
  [876, 780],
  [852, 762],
  [846, 751],
  [872, 745],
  [940, 740],
  [957, 680],
  [950, 610],
  [935, 566],
  [880, 540],
  [852, 528],
  [872, 517],
  [940, 510],
  [960, 430],
  [975, 300],
  [1000, 200],
  [1080, 110],
  [1400, 60],
  [3600, SURFACE_Y],
];

export const BASIN_D = `${smooth(BASIN)} Z`;
/** Everything below the surface that is not water (draw with fill-rule evenodd). */
export const ROCK_D = `M -3000 ${SURFACE_Y} H 4000 V 3000 H -3000 Z ${BASIN_D}`;
export const CAVE_D = `${smooth(CAVE)} Z`;

export const SURFACE_D = `M -3000 ${SURFACE_Y} q 10 -5 20 0${' t 20 0'.repeat(349)}`;
