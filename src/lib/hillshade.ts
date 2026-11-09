import { TERRAIN_EXTENT, heightAt } from '../data/terrain';

/**
 * Shaded relief for the terrain: light from the north-west, plus a faint
 * elevation tint (greener valleys, paler heights). Rendered once to an image
 * that sits under the contours and scales with the camera.
 */
export function renderHillshade(unitsPerPx = 2.5): { url: string; x: number; y: number; w: number; h: number } | null {
  const e = TERRAIN_EXTENT;
  const W = Math.round((e.x1 - e.x0) / unitsPerPx);
  const H = Math.round((e.y1 - e.y0) / unitsPerPx);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const hgt = new Float32Array((W + 2) * (H + 2));
  for (let j = 0; j < H + 2; j++) {
    for (let i = 0; i < W + 2; i++) hgt[j * (W + 2) + i] = heightAt(e.x0 + (i - 1) * unitsPerPx, e.y0 + (j - 1) * unitsPerPx);
  }

  const img = ctx.createImageData(W, H);
  const zScale = 0.07; // vertical exaggeration: metres to world units
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const lx = Math.cos(alt) * Math.sin(az);
  const ly = -Math.cos(alt) * Math.cos(az);
  const lz = Math.sin(alt);
  const paper = [243, 237, 222];
  const valley = [230, 232, 214];
  const height = [248, 245, 236];
  const fade = 260; // world units over which the relief fades out at the edges

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = (j + 1) * (W + 2) + (i + 1);
      const dzdx = ((hgt[k + 1] - hgt[k - 1]) * zScale) / (2 * unitsPerPx);
      const dzdy = ((hgt[k + W + 2] - hgt[k - W - 2]) * zScale) / (2 * unitsPerPx);
      const len = Math.hypot(dzdx, dzdy, 1);
      const shade = (-dzdx * lx - dzdy * ly + lz) / len; // 1 = facing the light
      const m = 1 + 0.12 * (shade - lz);
      const t = Math.min(1, Math.max(0, (hgt[k] - 450) / 1900));
      const base = paper.map((p, c) => {
        const tint = t < 0.5 ? valley[c] + (p - valley[c]) * (t * 2) : p + (height[c] - p) * ((t - 0.5) * 2);
        return tint;
      });
      const wx = e.x0 + i * unitsPerPx;
      const wy = e.y0 + j * unitsPerPx;
      const edge = Math.min(wx - e.x0, e.x1 - wx, wy - e.y0, e.y1 - wy);
      const a = Math.min(1, Math.max(0, edge / fade));
      const o = (j * W + i) * 4;
      img.data[o] = Math.min(255, base[0] * m);
      img.data[o + 1] = Math.min(255, base[1] * m);
      img.data[o + 2] = Math.min(255, base[2] * m);
      img.data[o + 3] = Math.round(255 * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL('image/png'), x: e.x0, y: e.y0, w: e.x1 - e.x0, h: e.y1 - e.y0 };
}
