import type { Point } from '../data/types';

type Extent = { x0: number; y0: number; x1: number; y1: number };
export type Grid = { x0: number; y0: number; cell: number; nx: number; ny: number; v: Float32Array };

export function sampleGrid(f: (x: number, y: number) => number, e: Extent, cell: number): Grid {
  const nx = Math.floor((e.x1 - e.x0) / cell) + 1;
  const ny = Math.floor((e.y1 - e.y0) / cell) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) v[j * nx + i] = f(e.x0 + i * cell, e.y0 + j * cell);
  }
  return { x0: e.x0, y0: e.y0, cell, nx, ny, v };
}

// Cell edges: 0 top, 1 right, 2 bottom, 3 left. Corner bits: tl 8, tr 4, br 2, bl 1.
const CASES: Record<number, [number, number][]> = {
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 6: [[0, 2]], 7: [[3, 0]],
  8: [[3, 0]], 9: [[0, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
};

/** Marching squares for one level, joined into polylines (closed rings end where they start). */
export function contourLines(g: Grid, level: number): Point[][] {
  const { nx, ny, v, x0, y0, cell } = g;
  const at = (i: number, j: number) => v[j * nx + i];
  const segs: [string, string][] = [];
  const pos = new Map<string, Point>();

  const edgePoint = (i: number, j: number, edge: number): string => {
    // Each edge gets a key shared by the two cells on either side of it.
    let key: string;
    let a: [number, number];
    let b: [number, number];
    if (edge === 0) [key, a, b] = [`h${i},${j}`, [i, j], [i + 1, j]];
    else if (edge === 2) [key, a, b] = [`h${i},${j + 1}`, [i, j + 1], [i + 1, j + 1]];
    else if (edge === 3) [key, a, b] = [`v${i},${j}`, [i, j], [i, j + 1]];
    else [key, a, b] = [`v${i + 1},${j}`, [i + 1, j], [i + 1, j + 1]];
    if (!pos.has(key)) {
      const va = at(a[0], a[1]);
      const vb = at(b[0], b[1]);
      const t = va === vb ? 0.5 : (level - va) / (vb - va);
      pos.set(key, {
        x: x0 + (a[0] + (b[0] - a[0]) * t) * cell,
        y: y0 + (a[1] + (b[1] - a[1]) * t) * cell,
      });
    }
    return key;
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = at(i, j);
      const tr = at(i + 1, j);
      const br = at(i + 1, j + 1);
      const bl = at(i, j + 1);
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      let pairs = CASES[idx];
      if (idx === 5 || idx === 10) {
        const centreAbove = (tl + tr + br + bl) / 4 > level;
        // 5: tr & bl above. 10: tl & br above.
        if (idx === 5) pairs = centreAbove ? [[3, 0], [2, 1]] : [[0, 1], [3, 2]];
        else pairs = centreAbove ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]];
      }
      for (const [ea, eb] of pairs) segs.push([edgePoint(i, j, ea), edgePoint(i, j, eb)]);
    }
  }

  // Join segments that share an edge point.
  const byKey = new Map<string, number[]>();
  segs.forEach(([a, b], s) => {
    for (const k of [a, b]) {
      const list = byKey.get(k);
      if (list) list.push(s);
      else byKey.set(k, [s]);
    }
  });
  const used = new Uint8Array(segs.length);
  const lines: Point[][] = [];
  const next = (key: string): number => (byKey.get(key) ?? []).find((s) => !used[s]) ?? -1;

  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const keys = [segs[s0][0], segs[s0][1]];
    for (const forward of [true, false]) {
      for (;;) {
        const end = forward ? keys[keys.length - 1] : keys[0];
        const s = next(end);
        if (s < 0) break;
        used[s] = 1;
        const other = segs[s][0] === end ? segs[s][1] : segs[s][0];
        if (forward) keys.push(other);
        else keys.unshift(other);
      }
    }
    lines.push(keys.map((k) => pos.get(k)!));
  }
  return lines;
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(pts: Point[], tol: number): Point[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = pts[a];
    const B = pts[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let dmax = tol;
    for (let i = a + 1; i < b; i++) {
      // A closed ring starts and ends at the same point: measure distance to that point.
      const d = len < 1e-9
        ? Math.hypot(pts[i].x - A.x, pts[i].y - A.y)
        : Math.abs(dy * pts[i].x - dx * pts[i].y + B.x * A.y - B.y * A.x) / len;
      if (d > dmax) [dmax, worst] = [d, i];
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Smooth path through the points (Catmull–Rom as cubic Béziers). */
export function smoothPath(pts: Point[]): string {
  const closed = pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.01;
  const p = closed ? pts.slice(0, -1) : pts;
  const n = p.length;
  if (n < 3) return `M${r1(p[0].x)} ${r1(p[0].y)}` + p.slice(1).map((q) => ` L${r1(q.x)} ${r1(q.y)}`).join('');
  const get = (i: number) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r1(p[0].x)} ${r1(p[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    d += ` C${r1(p1.x + (p2.x - p0.x) / 6)} ${r1(p1.y + (p2.y - p0.y) / 6)} ${r1(p2.x - (p3.x - p1.x) / 6)} ${r1(p2.y - (p3.y - p1.y) / 6)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return closed ? d + ' Z' : d;
}

export function polyPath(pts: Point[]): string {
  return `M${r1(pts[0].x)} ${r1(pts[0].y)}` + pts.slice(1).map((q) => `L${r1(q.x)} ${r1(q.y)}`).join('');
}
