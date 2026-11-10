import { memo, type CSSProperties } from 'react';
import { LANDMARKS, TRAILHEAD, landmarkById } from '../data/map';
import type { RegionId } from '../data/types';
import type { Cam, Size } from '../lib/camera';
import { BASIN_D, CAVE_D, DEPTH_LINES, FINE_DEPTH_YS, ROCK_D, SEABED_Y, SURFACE_D, SURFACE_Y } from '../data/sea';
import { MAIN_TRAIL_D, STRETCHES, spurPath, stopPoint } from '../lib/geometry';
import { useTheme } from '../lib/theme';
import { BRANCH_AT, LANDMARK_AT, lineAt, ms } from '../lib/intro';

type Props = {
  cam: Cam;
  stage: Size;
  /** Region whose concept stops are shown (route region, or the one we are leaving). */
  focus: RegionId | null;
  revealed: boolean;
  hot: RegionId | null;
  /** 0–1: how strongly to show the fine depth lines (they appear as you zoom in). */
  detail: number;
  /** Width in px of the panel covering the left of the stage; depth labels sit beside it. */
  gutter: number;
  /** Comma-separated ids of landmarks with at least one visited lesson. */
  walked: string;
  /** The opening sequence is playing (or about to): trails are revealed through masks. */
  intro: boolean;
};

const at = (t: number) => ({ ['--at' as string]: ms(t) }) as CSSProperties;
const TRAIL_MASK = 'url(#intro-trail)';
const branchMask = (id: string) => `url(#intro-${id})`;

const RAYS = [
  [150, 250, 40, -100],
  [430, 500, 380, 280],
  [640, 760, 700, 540],
  [900, 960, 1010, 930],
];

/** Static layers never change with the camera; only the viewBox does. */
const Sea = memo(function Sea() {
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="sea-water" gradientUnits="userSpaceOnUse" x1={0} y1={SURFACE_Y} x2={0} y2={SEABED_Y}>
          <stop offset="0" className="water-0" />
          <stop offset="0.35" className="water-1" />
          <stop offset="0.7" className="water-2" />
          <stop offset="1" className="water-3" />
        </linearGradient>
        <linearGradient id="sea-ray" gradientUnits="userSpaceOnUse" x1={0} y1={SURFACE_Y} x2={0} y2={560}>
          <stop offset="0" className="ray-0" />
          <stop offset="1" className="ray-1" />
        </linearGradient>
        <clipPath id="sea-basin">
          <path d={BASIN_D} />
        </clipPath>
      </defs>
      <rect x={-3000} y={-3000} width={7000} height={3000 + SURFACE_Y} className="sky" />
      <rect x={-3000} y={SURFACE_Y} width={7000} height={4000} fill="url(#sea-water)" />
      <g clipPath="url(#sea-basin)">
        {RAYS.map(([a, b, c, d]) => (
          <path key={a} d={`M ${a} ${SURFACE_Y} H ${b} L ${c} 560 H ${d} Z`} fill="url(#sea-ray)" />
        ))}
        {DEPTH_LINES.map((l) => (
          <line key={l.y} x1={-3000} x2={4000} y1={l.y} y2={l.y} className={l.index ? 'contour contour--index' : 'contour'} style={at(lineAt(l.y))} />
        ))}
      </g>
      <path d={ROCK_D} fillRule="evenodd" className="rock" />
      <path d={CAVE_D} className="cave" />
      <g className="reef" transform="translate(0 40)">
        <path d="M 878 477 c -2 -12 -11 -15 -9 -26 m 9 26 c 2 -11 10 -14 8 -24 m -8 24 v -19" />
        <path d="M 926 472 c -1 -10 -8 -12 -7 -21 m 7 21 c 3 -9 9 -10 8 -19" />
        <circle cx={900} cy={470} r={7} />
        <circle cx={911} cy={467} r={5} />
      </g>
      <g className="wreck" transform="translate(895 741) rotate(-7)">
        <path d="M -44 -14 H 40 L 30 0 H -34 Z M -8 -14 V -25 H 14 V -14" />
        <path d="M -24 -14 V -40" className="wreck__mast" />
      </g>
      <path d={SURFACE_D} className="surface" />
    </g>
  );
});

const FineLines = memo(function FineLines() {
  return (
    <g clipPath="url(#sea-basin)">
      {FINE_DEPTH_YS.map((y) => (
        <line key={y} x1={-3000} x2={4000} y1={y} y2={y} className="contour contour--minor" />
      ))}
    </g>
  );
});

/**
 * Intro reveal masks: a wide solid stroke drawn along each route (pathLength 1,
 * dash offset animated in CSS). Masking, rather than dashing the trail itself,
 * keeps the branches' own dash pattern intact while they draw.
 */
function RevealMasks({ width }: { width: number }) {
  const box = { x: -1000, y: -1000, width: 3000, height: 3000, maskUnits: 'userSpaceOnUse' as const };
  return (
    <defs>
      <mask id="intro-trail" {...box}>
        <path d={MAIN_TRAIL_D} pathLength={1} className="intro-reveal intro-reveal--trail" strokeWidth={width} />
      </mask>
      {STRETCHES.filter((s) => s.kind === 'branch').map((s) => (
        <mask key={s.id} id={`intro-${s.id}`} {...box}>
          <path
            d={s.d}
            pathLength={1}
            className="intro-reveal intro-reveal--branch"
            strokeWidth={width}
            style={{ ['--at' as string]: ms(BRANCH_AT[s.id]!.at), ['--dur' as string]: ms(BRANCH_AT[s.id]!.ms) }}
          />
        </mask>
      ))}
    </defs>
  );
}

const Trails = memo(function Trails({ hot, walked, intro, glow }: { hot: RegionId | null; walked: string; intro: boolean; glow: boolean }) {
  const done = new Set(walked.split(',').filter(Boolean));
  const trailMask = intro ? TRAIL_MASK : undefined;
  const maskFor = (id: string, kind: 'main' | 'branch') => (!intro ? undefined : kind === 'main' ? TRAIL_MASK : branchMask(id));
  return (
    <g aria-hidden="true">
      {/* At night the trail is lit: a blurred copper layer underneath it. */}
      {glow && <path d={MAIN_TRAIL_D} className="trail-glow" filter="url(#trail-glow)" mask={trailMask} />}
      {/* Paper-coloured casing separates the trail from contours underneath. */}
      <path d={MAIN_TRAIL_D} className="trail-casing" mask={trailMask} />
      {STRETCHES.filter((s) => s.kind === 'branch').map((s) => (
        <path key={`c-${s.id}`} d={s.d} className="trail-casing trail-casing--branch" mask={maskFor(s.id, 'branch')} />
      ))}
      {STRETCHES.filter((s) => s.kind === 'branch').map((s) => (
        <path key={s.id} d={s.d} className={`branch ${hot === s.id ? 'is-hot' : ''}`} mask={maskFor(s.id, 'branch')} />
      ))}
      <path d={MAIN_TRAIL_D} className="trail" mask={trailMask} />
      {/* Stretches leading to landmarks you have explored, drawn as walked. */}
      {STRETCHES.filter((s) => done.has(s.id)).map((s) => (
        <path key={`w-${s.id}`} d={s.d} className={s.kind === 'main' ? 'trail-walked' : 'branch-walked'} mask={maskFor(s.id, s.kind)} />
      ))}
      {STRETCHES.filter((s) => s.kind === 'main').map((s) => (
        <path key={s.id} d={s.d} className={`trail-hot ${hot === s.id ? 'is-hot' : ''}`} mask={trailMask} />
      ))}
    </g>
  );
});

export function Scene({ cam, stage, focus, revealed, hot, detail, gutter, walked, intro }: Props) {
  const w = stage.w / cam.k;
  const h = stage.h / cam.k;
  const viewBox = `${cam.cx - w / 2} ${cam.cy - h / 2} ${w} ${h}`;
  const r = (px: number) => px / cam.k;
  const night = useTheme() === 'dark';

  return (
    <svg className="scene" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {night && (
        <defs>
          {/* Blur in screen pixels, whatever the zoom. */}
          <filter id="trail-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={r(5)} />
          </filter>
        </defs>
      )}
      <Sea />
      {detail > 0.01 && (
        <g aria-hidden="true" style={{ opacity: detail }}>
          <FineLines />
        </g>
      )}
      <g className="depth-labels" aria-hidden="true">
        {DEPTH_LINES.map((l) => (
          <text key={l.y} x={cam.cx - w / 2 + r(gutter + 14)} y={l.y - r(5)} fontSize={r(11)}>
            {l.label}
          </text>
        ))}
      </g>
      {intro && <RevealMasks width={r(26)} />}
      <Trails hot={hot} walked={walked} intro={intro} glow={night} />

      {/* Concept waypoints: shown for the hovered landmark, a hint of what's inside. */}
      <g aria-hidden="true">
        {LANDMARKS.map((l) =>
          l.concepts.map((_, i) => {
            if (l.id === focus || l.id !== hot) return null;
            const p = stopPoint(l, i);
            return <circle key={`${l.id}-${i}`} cx={p.x} cy={p.y} r={r(2.6)} className="waypoint" style={at(LANDMARK_AT[l.id] + 160 + i * 50)} />;
          }),
        )}
      </g>

      {focus && (
        <g className={`spurs ${revealed ? 'is-revealed' : ''}`} aria-hidden="true">
          {landmarkById[focus].concepts.map((c, i) => (
            <path key={i} d={spurPath(landmarkById[focus], i)} className={c.detour ? 'spur spur--detour' : 'spur'} />
          ))}
        </g>
      )}

      <g className="trailhead" aria-hidden="true">
        <circle cx={TRAILHEAD.x} cy={TRAILHEAD.y} r={r(5)} />
        <circle cx={TRAILHEAD.x} cy={TRAILHEAD.y} r={r(10)} className="trailhead-ring" />
      </g>
    </svg>
  );
}
