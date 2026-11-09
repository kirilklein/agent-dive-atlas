import { useId, useMemo, useState } from 'react';
import { COMPARE_OUTPUT, COMPARE_PY, COMPARISON, type SetupResult } from '../data/companion';
import { halfWidth, paired } from '../lib/stats';
import { useWidth } from '../lib/useWidth';
import { CodeBlock } from './CodeBlock';

type Metric = {
  id: string;
  label: string;
  get: (r: SetupResult) => number;
  fmt: (v: number) => string;
  fmtDiff: (v: number) => string;
  better: 'higher' | 'lower';
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;

const METRICS: Metric[] = [
  { id: 'acc', label: 'Citation accuracy', get: (r) => r.supported / r.claims, fmt: pct, fmtDiff: pts, better: 'higher' },
  { id: 'lat', label: 'Latency', get: (r) => r.latency_s, fmt: (v) => `${v.toFixed(1)} s`, fmtDiff: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} s`, better: 'lower' },
  { id: 'cost', label: 'Cost', get: (r) => r.cost_usd, fmt: (v) => `$${v.toFixed(3)}`, fmtDiff: (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(4)}`, better: 'lower' },
];

const SW = 230;
const SH = 150;
const SX = [58, 188];

function SlopeChart({ m }: { m: Metric }) {
  const pairs = COMPARISON.map((q) => ({ id: q.id, a: m.get(q.single), b: m.get(q.reviewed) }));
  const all = pairs.flatMap((p) => [p.a, p.b]);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (m.id === 'acc') {
    lo = 0.4;
    hi = 1;
  } else {
    const pad = (hi - lo) * 0.15;
    lo = Math.max(0, lo - pad);
    hi += pad;
  }
  const y = (v: number) => 14 + (1 - (v - lo) / (hi - lo)) * (SH - 40);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg className="viz viz--slope" viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={`${m.label} per question, one assistant versus assistant plus reviewer`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={SX[0]} x2={SX[1]} y1={y(t)} y2={y(t)} className="viz__grid" />
          <text x={SX[0] - 10} y={y(t)} className="viz__tick" textAnchor="end" dominantBaseline="middle">
            {m.fmt(t)}
          </text>
        </g>
      ))}
      {pairs.map((p) => (
        <g key={p.id}>
          <title>{`${p.id}: ${m.fmt(p.a)} → ${m.fmt(p.b)} (${m.fmtDiff(p.b - p.a)})`}</title>
          <line x1={SX[0]} x2={SX[1]} y1={y(p.a)} y2={y(p.b)} className="viz__pairline" />
          <circle cx={SX[0]} cy={y(p.a)} r={4.5} className="viz__pt" />
          <circle cx={SX[1]} cy={y(p.b)} r={4.5} className="viz__pt viz__pt--b" />
        </g>
      ))}
      <text x={SX[0]} y={SH - 6} className="viz__tick" textAnchor="middle">One</text>
      <text x={SX[1]} y={SH - 6} className="viz__tick" textAnchor="middle">+ reviewer</text>
    </svg>
  );
}

export function CompareView() {
  const id = useId();
  const stats = useMemo(
    () => METRICS.map((m) => ({ m, s: paired(COMPARISON.map((q) => m.get(q.reviewed) - m.get(q.single))) })),
    [],
  );
  const acc = stats[0].s;
  const [n, setN] = useState(COMPARISON.length);
  const half = halfWidth(acc.sd, n);
  const [lo, hi] = [acc.mean - half, acc.mean + half];
  const AX = 0.6;
  const [boxRef, W] = useWidth<HTMLDivElement>(520);
  const x = (v: number) => 12 + ((v + AX) / (2 * AX)) * (W - 24);
  const clamp = (v: number) => Math.max(-AX, Math.min(AX, v));

  return (
    <section className="compare" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="section-title">
        Same questions, two setups
      </h3>
      <div className="viz-legend" aria-hidden="true">
        <span><i className="sw sw--a sw--dot" /> One assistant</span>
        <span><i className="sw sw--b sw--dot" /> Assistant + reviewer</span>
        <span><i className="sw sw--line" /> One question</span>
      </div>

      <div className="slopes">
        {stats.map(({ m, s }) => {
          const real = s.lo > 0 || s.hi < 0;
          return (
            <figure key={m.id} className="slope">
              <figcaption className="slope__head">
                <span className="slope__label">{m.label}</span>
                <span className={`chip ${real ? 'chip--real' : 'chip--unsure'}`}>{real ? 'Real difference' : 'Can’t tell yet'}</span>
              </figcaption>
              <SlopeChart m={m} />
              <p className="slope__stat">
                Mean change <strong>{m.fmtDiff(s.mean)}</strong>
                <br />
                95% interval {m.fmtDiff(s.lo)} to {m.fmtDiff(s.hi)}
              </p>
            </figure>
          );
        })}
      </div>

      <div className="power">
        <h4 className="power__title">How many questions would settle accuracy?</h4>
        <p className="power__lead">
          Keep the same mean change ({pts(acc.mean)}) and spread between questions, and grow the replay set.
        </p>
        <div className="viz-scroll" ref={boxRef}>
          <svg className="viz" width={W} height={64} viewBox={`0 0 ${W} 64`} role="img" aria-label={`95% interval for the accuracy change with ${n} questions`}>
            {[-0.5, -0.25, 0, 0.25, 0.5].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={6} y2={40} className={t === 0 ? 'viz__zero' : 'viz__grid'} />
                <text x={x(t)} y={58} className="viz__tick" textAnchor="middle">
                  {t === 0 ? 'no change' : pts(t)}
                </text>
              </g>
            ))}
            <line x1={x(clamp(lo))} x2={x(clamp(hi))} y1={24} y2={24} className="viz__ci viz__ci--b" />
            <line x1={x(clamp(lo))} x2={x(clamp(lo))} y1={18} y2={30} className="viz__ci viz__ci--b" />
            <line x1={x(clamp(hi))} x2={x(clamp(hi))} y1={18} y2={30} className="viz__ci viz__ci--b" />
            <circle cx={x(acc.mean)} cy={24} r={5} className="viz__pt viz__pt--b" />
          </svg>
        </div>
        <div className="tk__ctl">
          <label htmlFor={`${id}-n`}>
            Questions in the replay set <strong>{n}</strong>
          </label>
          <input id={`${id}-n`} type="range" min={5} max={300} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </div>
        <p className="iv__readout" aria-live="polite">
          {lo > 0
            ? `With ${n} questions the interval is ${pts(lo)} to ${pts(hi)}: it excludes zero, so the improvement would be real.`
            : `With ${n} questions the interval is ${pts(lo)} to ${pts(hi)}: it still includes zero. At this effect size you need about ${acc.needed}.`}
        </p>
      </div>

      <details className="per-q">
        <summary>Per-question results</summary>
        <div className="viz-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Supported, one</th>
                <th scope="col">Supported, + reviewer</th>
                <th scope="col">Latency</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((q) => (
                <tr key={q.id}>
                  <th scope="row">{q.id}</th>
                  <td>
                    {q.single.supported}/{q.single.claims}
                  </td>
                  <td>
                    {q.reviewed.supported}/{q.reviewed.claims}
                  </td>
                  <td>
                    {q.single.latency_s.toFixed(1)} → {q.reviewed.latency_s.toFixed(1)} s
                  </td>
                  <td>
                    ${q.single.cost_usd.toFixed(3)} → ${q.reviewed.cost_usd.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="per-q">
        <summary>
          Run it: <code>python compare.py</code>
        </summary>
        <pre className="terminal">{COMPARE_OUTPUT}</pre>
        <CodeBlock code={COMPARE_PY.code} language="python" label="compare.py" className="code--file" />
      </details>
      <p className="fixture-note">Illustrative recorded results, not a benchmark. compare.py computes the same numbers.</p>
    </section>
  );
}
