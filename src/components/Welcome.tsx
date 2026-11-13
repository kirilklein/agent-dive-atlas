import type { ReactNode } from 'react';
import { EXAMPLE } from '../data/companion';
import { LANDMARKS, MAIN_ROUTE } from '../data/map';
import { ThemeToggle } from './ThemeToggle';

const BRANCHES = LANDMARKS.filter((l) => l.kind === 'branch').length;

const STEPS: { title: string; body: string; glyph: ReactNode }[] = [
  {
    title: 'Follow the dive line',
    body: `${MAIN_ROUTE.length} stations descend from the surface to the seabed: from one model call to an evaluated agent. Each builds on the last.`,
    glyph: (
      <>
        <path d="M8 8c9 3 4 12 13 15s5 12 14 15" className="welcome__ink-trail" />
        <circle cx="8" cy="8" r="3" className="welcome__ink-mark" />
        <circle cx="21" cy="23" r="3" className="welcome__ink-mark" />
        <circle cx="35" cy="38" r="4" className="welcome__ink-mark" />
      </>
    ),
  },
  {
    title: 'Open a station',
    body: 'Click one and the map flies in. Its stops are short lessons, with the real code and runs you can step through.',
    glyph: (
      <>
        <circle cx="24" cy="24" r="7" className="welcome__ink-ring" />
        <circle cx="24" cy="24" r="2.6" className="welcome__ink-mark" />
        <circle cx="9" cy="17" r="2.4" className="welcome__ink-stop" />
        <circle cx="38" cy="12" r="2.4" className="welcome__ink-stop" />
        <circle cx="39" cy="35" r="2.4" className="welcome__ink-stop" />
        <circle cx="12" cy="37" r="2.4" className="welcome__ink-stop" />
      </>
    ),
  },
  {
    title: 'Explore, then come back up',
    body: `${BRANCHES} side dives are optional. Escape or Back takes you up a level, and the line you have dived stays marked.`,
    glyph: (
      <>
        <path d="M10 6C14 18 20 26 24 42" className="welcome__ink-trail" />
        <path d="M18 22c6-1 12 0 20 4" className="welcome__ink-branch" />
        <circle cx="38" cy="26" r="3" className="welcome__ink-mark" />
        <circle cx="17.5" cy="22" r="2.4" className="welcome__ink-mark" />
      </>
    ),
  },
];

export function Welcome({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="welcome">
      <svg className="welcome__contours" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {[60, 120, 180, 240, 300, 360, 420].map((r, i) => (
          <ellipse key={r} cx={560 - i * 6} cy={300 + i * 8} rx={r * 1.25} ry={r} transform={`rotate(${-18 + i * 2} 560 300)`} />
        ))}
      </svg>
      <div className="welcome__toggle">
        <ThemeToggle />
      </div>

      <main className="welcome__sheet">
        <p className="kicker">A dive atlas · Chart I</p>
        <h1 className="welcome__title">Agent Dive Atlas</h1>
        <p className="welcome__lede">
          A dive into LLM agents, by building one: a trip planner for a rainy day in Florence, in
          plain Python.
          Every run is recorded, so you need no API key.
        </p>

        <h2 className="welcome__how">What you will build</h2>
        <div className="welcome__example">
          <p className="welcome__question">“{EXAMPLE.question}”</p>
          <ol className="welcome__run">
            {EXAMPLE.searches.map((q) => (
              <li key={q}>
                <span>searches</span>
                <code>search_places("{q}")</code>
              </li>
            ))}
            <li>
              <span>answers</span>
              <p>
                {EXAMPLE.answer.split(/(\[place:[a-z-]+\])/).map((part, i) =>
                  i % 2 ? <code key={i}>{part}</code> : part,
                )}
              </p>
            </li>
          </ol>
          <p className="welcome__note">
            Each station adds one piece of this planner, and every lesson uses it as the example.
          </p>
        </div>

        <h2 className="welcome__how">How to dive</h2>
        <ol className="welcome__steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="welcome__step" style={{ ['--i' as string]: i }}>
              <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
                {s.glyph}
              </svg>
              <div>
                <h3>
                  <span className="welcome__num">{i + 1}</span>
                  {s.title}
                </h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <button type="button" className="btn btn--primary btn--start welcome__enter" onClick={onEnter}>
          Start the dive
          <span aria-hidden="true"> →</span>
        </button>
      </main>
    </div>
  );
}
