import type { ReactNode } from 'react';

/** A deliberately small highlighter: enough to make code scannable, no dependency. */

const PY_KEYWORDS =
  'def|return|if|elif|else|not|in|for|while|try|except|as|raise|import|from|class|and|or|is|continue|break|with|lambda|pass|None|True|False';
const PY_BUILTINS = 'len|isinstance|print|range|sum|set|list|dict|str|int|json|field|dataclass|enumerate';

const PY_RE = new RegExp(
  [
    '(#.*$)', // 1 comment
    '((?:f|r)?"(?:[^"\\\\]|\\\\.)*"|(?:f|r)?\'(?:[^\'\\\\]|\\\\.)*\')', // 2 string
    `\\b(${PY_KEYWORDS})\\b`, // 3 keyword
    `\\b(${PY_BUILTINS})\\b(?=\\s*[.(])`, // 4 builtin
    '(@\\w+)', // 5 decorator
    '\\b(\\d+(?:\\.\\d+)?)\\b', // 6 number
  ].join('|'),
  'g',
);

const JSON_RE = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g;

function tokens(line: string, re: RegExp, classify: (m: RegExpExecArray) => string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push(line.slice(last, m.index));
    out.push(
      <span key={m.index} className={`tok-${classify(m)}`}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function highlightLines(code: string, language: 'python' | 'json' | 'text'): ReactNode[][] {
  const lines = code.split('\n');
  if (language === 'text') return lines.map((l) => [l]);
  if (language === 'json') {
    return lines.map((l) =>
      tokens(l, JSON_RE, (m) => (m[1] && m[2] ? 'key' : m[1] ? 'str' : m[3] ? 'kw' : 'num')),
    );
  }
  let inDoc = false;
  return lines.map((l) => {
    const triple = (l.match(/"""/g) ?? []).length;
    if (inDoc || triple > 0) {
      const wasIn = inDoc;
      if (triple % 2 === 1) inDoc = !inDoc;
      if (wasIn || triple > 0) return [<span key="d" className="tok-str">{l}</span>];
    }
    return tokens(l, PY_RE, (m) =>
      m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'kw' : m[4] ? 'fn' : m[5] ? 'deco' : 'num',
    );
  });
}

/** Render prose with `backtick` spans as inline code. */
export function inlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}
