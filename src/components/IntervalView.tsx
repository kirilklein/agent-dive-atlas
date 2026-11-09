import { useId, useState } from 'react';
import { wilson } from '../lib/stats';
import { useWidth } from '../lib/useWidth';

const SIZES = [12, 25, 50, 100, 200, 400, 1000];
const ROW = 46;
const PAD = { l: 8, r: 8 };

type Row = { label: string; k: number; n: number; note?: string };

export function IntervalView() {
  const id = useId();
  const [boxRef, W] = useWidth<HTMLDivElement>(520);
  const [sizeIdx, setSizeIdx] = useState(0);
  const n = SIZES[sizeIdx];
  const rate = 11 / 12;
  const rows: Row[] = [
    { label: 'Replay: claims supported', k: 11, n: 12, note: 'as reported' },
    { label: 'Judge agrees with a person', k: 10, n: 12 },
    { label: `Same 92% rate on ${n.toLocaleString('en-US')} claims`, k: Math.round(rate * n), n, note: 'if it held' },
  ];
  const H = rows.length * ROW + 28;
  const x = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
  const [lo, hi] = wilson(Math.round(rate * n), n);

  return (
    <section className="interval" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="section-title">
        How wide is 11 out of 12?
      </h3>
      <div className="viz-scroll" ref={boxRef}>
        <svg className="viz" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="95% intervals for the replay score, the judge agreement and a larger replay">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={8} y2={H - 22} className="viz__grid" />
              <text x={x(t)} y={H - 6} className="viz__tick" textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}>
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {rows.map((row, i) => {
            const [a, b] = wilson(row.k, row.n);
            const p = row.k / row.n;
            const cy = 18 + i * ROW + 20;
            return (
              <g key={row.label}>
                <title>{`${row.label}: ${row.k}/${row.n} = ${Math.round(p * 100)}%, 95% interval ${Math.round(a * 100)}–${Math.round(b * 100)}%`}</title>
                <text x={PAD.l} y={cy - 13} className="viz__label">
                  {row.label}
                  <tspan className="viz__muted">
                    {'  '}
                    {row.k}/{row.n}
                    {row.note ? ` · ${row.note}` : ''}
                  </tspan>
                </text>
                <line x1={x(a)} x2={x(b)} y1={cy} y2={cy} className={`viz__ci ${i === 2 ? 'viz__ci--b' : ''}`} />
                <line x1={x(a)} x2={x(a)} y1={cy - 5} y2={cy + 5} className={`viz__ci ${i === 2 ? 'viz__ci--b' : ''}`} />
                <line x1={x(b)} x2={x(b)} y1={cy - 5} y2={cy + 5} className={`viz__ci ${i === 2 ? 'viz__ci--b' : ''}`} />
                <circle cx={x(p)} cy={cy} r={5} className={`viz__pt ${i === 2 ? 'viz__pt--b' : ''}`} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="tk__ctl iv__ctl">
        <label htmlFor={`${id}-n`}>
          Claims checked <strong>{n.toLocaleString('en-US')}</strong>
        </label>
        <input
          id={`${id}-n`}
          type="range"
          min={0}
          max={SIZES.length - 1}
          step={1}
          value={sizeIdx}
          onChange={(e) => setSizeIdx(Number(e.target.value))}
          aria-valuetext={`${n} claims`}
        />
      </div>
      <p className="iv__readout" aria-live="polite">
        With {n.toLocaleString('en-US')} claims, a 92% rate is pinned to {Math.round(lo * 100)}–{Math.round(hi * 100)}%: a
        spread of {Math.round((hi - lo) * 100)} points. The interval narrows roughly with the square root of the number of
        claims, so halving it takes four times as many.
      </p>
    </section>
  );
}
