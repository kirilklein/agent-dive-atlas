import { useId, useState } from 'react';
import { compact, fmtInt, niceTicks } from '../lib/stats';
import { useWidth } from '../lib/useWidth';

const H = 230;
const PAD = { l: 46, r: 10, t: 12, b: 28 };

/** Path for a bar whose top corners are rounded (data end) and bottom is square (baseline). */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function TokenCostView() {
  const id = useId();
  const [boxRef, W] = useWidth<HTMLDivElement>(560);
  const [P, setP] = useState(1200);
  const [r, setR] = useState(900);
  const [n, setN] = useState(12);
  const [keep, setKeep] = useState(0); // 0 = keep everything

  const full = (i: number) => P + (i - 1) * r;
  const sent = (i: number) => P + (keep ? Math.min(i - 1, keep) : i - 1) * r;
  const steps = Array.from({ length: n }, (_, i) => i + 1);
  const totalFull = n * P + (r * n * (n - 1)) / 2;
  const totalSent = steps.reduce((a, i) => a + sent(i), 0);
  const lastShare = ((sent(n) - P) / sent(n)) * 100;

  const ticks = niceTicks(full(n));
  const yMax = ticks[ticks.length - 1];
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + plotH - (v / yMax) * plotH;
  const slot = plotW / n;
  const bw = Math.min(24, slot * 0.66);
  const bx = (i: number) => PAD.l + slot * (i - 0.5) - bw / 2;

  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, fmt: (v: number) => string, key: string) => (
    <div className="tk__ctl">
      <label htmlFor={`${id}-${key}`}>
        {label} <strong>{fmt(value)}</strong>
      </label>
      <input id={`${id}-${key}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <section className="tokens" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="section-title">
        Watch the history grow
      </h3>
      <div className="tk__controls">
        {slider('Prompt + question, P', P, setP, 300, 4000, 100, (v) => `${fmtInt(v)} tokens`, 'p')}
        {slider('Added per step, r', r, setR, 100, 3000, 100, (v) => `${fmtInt(v)} tokens`, 'r')}
        {slider('Model calls, n', n, setN, 2, 30, 1, (v) => `${v}`, 'n')}
        {slider('Keep the last k results', keep, setKeep, 0, 6, 1, (v) => (v ? `k = ${v}` : 'all of them'), 'k')}
      </div>

      <div className="viz-legend" aria-hidden="true">
        <span><i className="sw sw--a" /> Prompt + question (P)</span>
        <span><i className="sw sw--b" /> History resent</span>
        {keep > 0 && <span><i className="sw sw--ghost" /> Without trimming</span>}
      </div>
      <div className="viz-scroll" ref={boxRef}>
        <svg className="viz" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Input tokens per model call, for ${n} calls`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="viz__grid" />
              <text x={PAD.l - 8} y={y(t)} className="viz__tick" textAnchor="end" dominantBaseline="middle">
                {compact(t)}
              </text>
            </g>
          ))}
          {steps.map((i) => {
            const x = bx(i);
            const total = sent(i);
            const hist = total - P;
            const gap = hist > 0 ? 2 : 0;
            return (
              <g key={i}>
                <title>{`Call ${i}: ${fmtInt(total)} tokens (${fmtInt(P)} prompt + ${fmtInt(hist)} history)`}</title>
                {keep > 0 && full(i) > total && (
                  <path d={topRounded(x, y(full(i)), bw, y(total) - y(full(i)), 4)} className="viz__ghost" />
                )}
                {hist > 0 ? (
                  <>
                    <rect x={x} y={y(P)} width={bw} height={y(0) - y(P)} className="viz__a" />
                    <path d={topRounded(x, y(total), bw, Math.max(0, y(P) - y(total) - gap), 4)} className="viz__b" />
                  </>
                ) : (
                  <path d={topRounded(x, y(P), bw, y(0) - y(P), 4)} className="viz__a" />
                )}
                <rect x={PAD.l + slot * (i - 1)} y={PAD.t} width={slot} height={plotH} className="viz__hit" />
              </g>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="viz__axis" />
          {steps
            .filter((i) => i === 1 || i === n || (n <= 12 ? true : i % 5 === 0))
            .map((i) => (
              <text key={i} x={PAD.l + slot * (i - 0.5)} y={H - 8} className="viz__tick" textAnchor="middle">
                {i}
              </text>
            ))}
        </svg>
      </div>
      <p className="viz__caption">Input tokens sent on each call. Hover a bar for its numbers.</p>

      <dl className="tk__totals">
        <div>
          <dt>Total without trimming</dt>
          <dd>
            <span className="tk__formula">
              nP + r·n(n−1)/2 = {n}·{fmtInt(P)} + {fmtInt(r)}·{(n * (n - 1)) / 2}
            </span>
            <strong>{fmtInt(totalFull)} tokens</strong>
          </dd>
        </div>
        <div>
          <dt>{keep ? `Keeping the last ${keep} result${keep > 1 ? 's' : ''}` : 'Keeping everything'}</dt>
          <dd>
            <strong>{fmtInt(totalSent)} tokens</strong>
            {keep > 0 && <span className="tk__save">{Math.round((1 - totalSent / totalFull) * 100)}% less</span>}
          </dd>
        </div>
        <div>
          <dt>History share of the last call</dt>
          <dd>
            <strong>{Math.round(lastShare)}%</strong>
          </dd>
        </div>
      </dl>
    </section>
  );
}
