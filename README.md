# Agent Dive Atlas

An interactive dive for engineers who want to understand LLM agents by building one: a trip planner that answers "Rainy Saturday in Florence with a 4-year-old: what can we do?", in plain Python, from one model call to an evaluated agent. Everything runs on recorded fixtures — no API key.

You start at the surface and descend. Four stations sit on the main dive line, each deeper than the last, and three optional side dives branch off to a reef, a cave and a wreck. It is the ocean sibling of [agent-field-atlas](https://github.com/kirilklein/agent-field-atlas), with the same lessons and code.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
# or the production build
npm run build && npm run preview   # http://localhost:4173
```

### Single-page build

`npm run build:artifact` bundles the app into one self-contained page at `dist-artifact/agent-dive-atlas.html` (scripts and styles inlined, fonts from Google Fonts), suitable for hosting as a single file.

## Python companion

`companion/` holds the trip planner itself: four runnable checkpoints (one per station), `compare.py` for the Multi-agent side dive, a scripted fake model so everything runs offline, and an adapter for Claude (`ATLAS_MODEL=claude`). The atlas imports these files and their recorded output (`companion/expected/`) directly, so the lessons always show the real code. After changing a checkpoint, re-record its output; see `companion/README.md`.

## How it's put together

| Path | What it holds |
|---|---|
| `src/data/map.ts` | Hand-placed stations, concept stops, side-dive curves and place names (world units; y is depth) |
| `src/data/sea.ts` | The cross-section: surface, depth scale and lines, rock walls, trench floor and cave |
| `src/data/lessons.ts` | Explanation, example and interaction for every concept |
| `src/data/traces.ts` | Deterministic step-through fixtures (Inspect a call, Parse a reply, Watch a run, Score a replay, Untrusted results) |
| `src/data/companion.ts` | Imports the Python companion, its fixtures and expected output as text |
| `src/lib/progress.ts` | Which lessons this viewer has opened (browser storage only), drawn as the dived line and station rings |
| `src/lib/stats.ts` | Wilson and paired t-intervals, the same maths as the companion |
| `src/lib/camera.ts` | The single camera: `fit()` targets and the anchor-preserving animation |
| `src/lib/route.ts` | Hash routes (`#tool-calling`, `#tool-calling--inspect-a-call`) — the source of truth for the view |
| `src/lib/geometry.ts` | Dive-line stretches, spurs and framing boxes |
| `src/components/` | SVG scene, HTML markers, cards, workbench, trace stepper |

The route decides the camera target; the camera animates zoom geometrically while moving the selected station in a straight line on screen, so the station stays in view. A new route mid-flight restarts from the current camera, so fast clicks and Back stay in sync. `prefers-reduced-motion` jumps straight to the target. Labels and controls are HTML outside the camera transform, so they stay crisp at every scale.

Map controls: the +, − and recenter buttons sit at the top right of the map. Drag to pan; scroll or pinch to zoom at the cursor. On phones one finger keeps scrolling the page and two fingers move and zoom the map; in a narrow desktop window, Ctrl/⌘ + scroll zooms. Free pan/zoom never changes the URL — clicking a station, Back, or recenter flies to the route's view.

Keyboard: Tab through stations and stops, Enter to open, Escape to go up a level, ←/→ to step through a trace. With the map focused, arrow keys pan, + / − zoom and 0 recenters.
