import { useEffect, useState } from 'react';

const NODES = [
  { name: 'Messages', x: 0, y: 0, caption: 'Everything the model knows is in the message list.' },
  { name: 'Model', x: 176, y: 0, caption: 'The model reads it and proposes: an answer or a tool call.' },
  { name: 'Your code', x: 176, y: 92, caption: 'Your code decides: check the proposal, run it, refuse it or stop.' },
  { name: 'Tools', x: 0, y: 92, caption: 'Allowed calls run. The result joins the messages for the next call.' },
];
const W = 100;
const H = 30;
// Clockwise edges: from node i to node i+1.
const EDGES = [
  `M${W} 15 H176`,
  `M${176 + W / 2} ${H} V92`,
  `M176 ${92 + 15} H${W}`,
  `M${W / 2} 92 V${H}`,
];

/** The one idea, animated: the cycle every landmark on the trail builds on. */
export function Hub({ reduced }: { reduced: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(reduced);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % NODES.length), 1900);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <figure className="hub" aria-label="How it all connects">
      <figcaption className="motif__cap">How it all connects</figcaption>
      <svg viewBox="-2 -2 280 128" className="hub__svg" role="img" aria-label="Messages to model to your code to tools, and back to messages">
        <defs>
          <marker id="hub-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" className="hub__arrowhead" />
          </marker>
        </defs>
        {EDGES.map((d, i) => (
          <path key={d} d={d} className={`hub__edge ${i === (active + NODES.length - 1) % NODES.length && !reduced ? 'is-on' : ''}`} markerEnd="url(#hub-arrow)" />
        ))}
        {NODES.map((n, i) => (
          <g
            key={n.name}
            className={`hub__node ${i === active ? 'is-on' : ''}`}
            onClick={() => {
              setActive(i);
              setPaused(true);
            }}
          >
            <rect x={n.x} y={n.y} width={W} height={H} rx={7} />
            <text x={n.x + W / 2} y={n.y + H / 2 + 1} textAnchor="middle" dominantBaseline="middle">
              {n.name}
            </text>
          </g>
        ))}
      </svg>
      <p className="hub__caption" aria-live="polite">
        {NODES[active].caption}
      </p>
      <div className="hub__controls">
        {NODES.map((n, i) => (
          <button
            key={n.name}
            type="button"
            className={`hub__dot ${i === active ? 'is-on' : ''}`}
            aria-label={`Show: ${n.name}`}
            aria-pressed={i === active}
            onClick={() => {
              setActive(i);
              setPaused(true);
            }}
          />
        ))}
        {!reduced && (
          <button type="button" className="linkish hub__play" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>
    </figure>
  );
}
