import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SEABED_Y, SURFACE_Y } from '../data/sea';
import type { Cam, Size } from './camera';

/**
 * The water as a fragment shader: one full-screen canvas under the SVG map,
 * drawn from the same camera. Colours come from the --water-* and --sky tokens,
 * so it agrees with the flat SVG sea it replaces.
 */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uScale;
uniform float uTime;
uniform float uNight;
uniform vec3 uWater[6];
uniform vec3 uSky;
out vec4 outColor;

const float SURF = ${SURFACE_Y.toFixed(1)};
const float BED = ${SEABED_Y.toFixed(1)};

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

vec3 water(float z) {
  float st[6] = float[6](0.0, 0.15, 0.3, 0.5, 0.75, 1.0);
  vec3 c = uWater[0];
  for (int i = 1; i < 6; i++) c = mix(c, uWater[i], smoothstep(st[i - 1], st[i], z));
  return c;
}

float snowLayer(vec2 px, vec2 stage, float f, float t) {
  vec2 q = uCam.xy * uCam.z * f + (px - stage * 0.5);
  q += vec2(sin(t * 0.13 + f * 7.0) * 18.0, -t * (5.0 + f * 9.0));
  float cell = 44.0 - f * 16.0;
  vec2 g = q / cell;
  vec2 id = floor(g);
  vec2 fp = fract(g);
  float h = hash(id + f * 13.0);
  if (h < 0.5) return 0.0;
  vec2 pos = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.7 + 0.15;
  float r = (0.5 + 1.1 * hash(id + 1.3)) * (0.5 + f) / cell;
  return smoothstep(r, r * 0.15, length(fp - pos)) * (0.35 + 0.65 * f);
}

float glowLayer(vec2 px, vec2 stage, float t) {
  vec2 q = uCam.xy * uCam.z * 0.7 + (px - stage * 0.5) + vec2(t * 2.0, -t * 1.5);
  float cell = 120.0;
  vec2 id = floor(q / cell);
  vec2 fp = fract(q / cell);
  float h = hash(id + 91.0);
  if (h < 0.9) return 0.0;
  vec2 pos = vec2(hash(id + 5.3), hash(id + 2.9)) * 0.6 + 0.2;
  float d = length((fp - pos) * cell);
  float pulse = 0.5 + 0.5 * sin(t * (0.8 + h * 1.5) + h * 40.0);
  return exp(-d * d / 18.0) * pulse + exp(-d / 9.0) * 0.25 * pulse;
}

void main() {
  vec2 stage = uRes / uScale;
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 w = uCam.xy + (px - stage * 0.5) / uCam.z;
  float t = uTime;
  float aa = 1.0 / uCam.z;
  float light = mix(1.0, 0.3, uNight);

  float surf = SURF + 1.3 * sin(w.x * 0.045 + t * 1.1) + 0.7 * sin(w.x * 0.11 - t * 1.7);
  float dy = w.y - surf;

  vec3 sky = mix(uSky, uSky * vec3(0.86, 0.93, 0.98), smoothstep(SURF - 300.0, SURF, w.y));
  float star = step(0.9975, hash(floor(px / 2.0))) * uNight * (0.6 + 0.4 * sin(t * 2.0 + hash(floor(px / 2.0) + 1.0) * 30.0));
  sky += vec3(star);

  float z = clamp((w.y - SURF) / (BED - SURF), 0.0, 1.0);
  vec3 c = water(z);
  c *= 0.93 + 0.14 * fbm(w * 0.005 + vec2(t * 0.012, t * 0.004));

  c += vec3(0.5, 0.75, 0.82) * exp(-max(dy, 0.0) * 0.06) * 0.14 * light;

  float u = w.x + dy * 0.34;
  float shaft = smoothstep(0.5, 0.85, fbm(vec2(u * 0.011 + t * 0.012, t * 0.025)));
  float shaftFade = exp(-max(dy, 0.0) / 170.0) * smoothstep(0.0, 14.0, dy);
  c += vec3(0.62, 0.86, 0.9) * shaft * shaftFade * 0.34 * light;

  vec2 cp = w * 0.07;
  float ca = abs(sin(cp.x + fbm(cp * 0.6 + t * 0.22) * 4.0) * sin(cp.y * 1.3 + fbm(cp * 0.6 - t * 0.18) * 4.0));
  c += vec3(0.75, 0.92, 0.95) * pow(1.0 - ca, 7.0) * exp(-max(dy, 0.0) / 40.0) * 0.1 * light;

  float snow = snowLayer(px, stage, 0.35, t) + snowLayer(px, stage, 0.6, t) + snowLayer(px, stage, 0.85, t);
  c += vec3(0.78, 0.87, 0.9) * snow * mix(0.06, 0.42, smoothstep(0.12, 0.55, z));

  c += vec3(0.25, 0.95, 0.85) * glowLayer(px, stage, t) * smoothstep(0.42, 0.7, z) * mix(0.7, 1.0, uNight);

  c += vec3(0.85, 0.96, 1.0) * smoothstep(2.0 * aa, 0.0, abs(dy)) * mix(0.55, 0.3, uNight);

  vec3 col = mix(sky, c, smoothstep(-aa, aa, dy));
  vec2 v = px / stage - 0.5;
  col *= 1.0 - dot(v, v) * 0.3;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

type Renderer = {
  draw: (cam: Cam, stage: Size, time: number) => void;
  setPalette: (night: boolean) => void;
};

function hexToRgb(hex: string): number[] {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = (n: string) => gl.getUniformLocation(prog, n);
  const u = { res: loc('uRes'), cam: loc('uCam'), scale: loc('uScale'), time: loc('uTime'), night: loc('uNight'), water: loc('uWater'), sky: loc('uSky') };

  return {
    draw(cam, stage, time) {
      // Capped resolution: the water is soft, so it needs few pixels.
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (stage.w * stage.h > 1.6e6 ? 0.75 : 1);
      const w = Math.max(1, Math.round(stage.w * scale));
      const h = Math.max(1, Math.round(stage.h * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.scale, w / stage.w);
      gl.uniform3f(u.cam, cam.cx, cam.cy, cam.k);
      gl.uniform1f(u.time, time / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    setPalette(night) {
      const css = getComputedStyle(document.documentElement);
      gl.uniform3fv(u.water, [0, 1, 2, 3, 4, 5].flatMap((i) => hexToRgb(css.getPropertyValue(`--water-${i}`))));
      gl.uniform3fv(u.sky, hexToRgb(css.getPropertyValue('--sky')));
      gl.uniform1f(u.night, night ? 1 : 0);
    },
  };
}

/**
 * Draws the water while `enabled`; `live` turns true once the first frame is on
 * screen (false when WebGL2 or the shader is unavailable, so the SVG sea stays).
 */
export function useSeaWater(enabled: boolean, getCam: () => Cam, cam: Cam, stage: Size, night: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [live, setLive] = useState(false);
  const view = useRef({ getCam, stage });
  useLayoutEffect(() => {
    view.current = { getCam, stage };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    const r = createRenderer(canvas);
    if (!r) return;
    renderer.current = r;
    r.setPalette(document.documentElement.dataset.theme === 'dark');
    let first = true;
    let raf = 0;
    const loop = (now: number) => {
      if (!document.hidden && view.current.stage.w > 1) r.draw(view.current.getCam(), view.current.stage, now);
      if (first) setLive(true);
      first = false;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      renderer.current = null;
      setLive(false);
    };
  }, [enabled]);

  useEffect(() => renderer.current?.setPalette(night), [night, live]);

  // Redraw in the same frame as the SVG when the camera moves.
  useLayoutEffect(() => {
    if (stage.w > 1) renderer.current?.draw(cam, stage, performance.now());
  }, [cam, stage]);

  return { canvasRef, live };
}
