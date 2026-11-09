import { useEffect, useMemo, useRef } from 'react';
import { highlightLines } from '../lib/highlight';

type Props = {
  code: string;
  language: 'python' | 'json' | 'text';
  label?: string;
  highlight?: number[];
  /** Scroll the listing (not the page) so highlighted lines are visible. */
  follow?: boolean;
  smooth?: boolean;
  className?: string;
};

export function CodeBlock({ code, language, label, highlight, follow, smooth, className }: Props) {
  const lines = useMemo(() => highlightLines(code, language), [code, language]);
  const hot = useMemo(() => new Set(highlight ?? []), [highlight]);
  const scroller = useRef<HTMLDivElement>(null);
  const hasHighlight = hot.size > 0;

  useEffect(() => {
    if (!follow || !hasHighlight || !scroller.current) return;
    const box = scroller.current;
    const first = box.querySelector<HTMLElement>('.code__line.is-hot');
    const last = [...box.querySelectorAll<HTMLElement>('.code__line.is-hot')].pop();
    if (!first || !last) return;
    const top = first.offsetTop;
    const bottom = last.offsetTop + last.offsetHeight;
    const view = box.clientHeight;
    let target = box.scrollTop;
    if (top < box.scrollTop + 8 || bottom > box.scrollTop + view - 8) {
      target = bottom - top < view ? top - (view - (bottom - top)) / 2 : top - 8;
    }
    box.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
  }, [follow, hasHighlight, hot, smooth]);

  return (
    <figure className={`code ${hasHighlight ? 'has-highlight' : ''} ${className ?? ''}`}>
      {label && (
        <figcaption className="code__label">
          <span>{label}</span>
        </figcaption>
      )}
      <div className="code__scroll" ref={scroller} tabIndex={0} aria-label={label ? `Code: ${label}` : 'Code listing'}>
        <pre>
          <code>
            {lines.map((tokens, i) => (
              <span key={i} className={`code__line ${hot.has(i + 1) ? 'is-hot' : ''}`}>
                <span className="code__ln" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="code__text">{tokens.length ? tokens : ' '}</span>
                {'\n'}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
