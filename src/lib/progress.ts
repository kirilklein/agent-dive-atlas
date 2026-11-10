import { useCallback, useEffect, useState } from 'react';
import { LANDMARKS } from '../data/map';
import type { RegionId } from '../data/types';
import type { Route } from './route';

/**
 * Which lessons this viewer has opened. Kept in this browser only (localStorage),
 * and every read and write is guarded: private windows and blocked storage
 * simply start with no progress.
 */
const KEY = 'agent-dive-atlas:visited:v1';

function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
}

export const TOTAL_STOPS = LANDMARKS.reduce((n, l) => n + l.concepts.length, 0);

export type Progress = {
  visited: Set<string>;
  has: (region: RegionId, concept: string) => boolean;
  /** Fraction of a landmark's concepts visited, 0–1. */
  share: (region: RegionId) => number;
  reset: () => void;
};

export function useProgress(route: Route): Progress {
  const [visited, setVisited] = useState<Set<string>>(read);

  useEffect(() => {
    if (!route.region || !route.concept) return;
    const key = `${route.region}/${route.concept}`;
    setVisited((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev).add(key);
      write(next);
      return next;
    });
  }, [route.region, route.concept]);

  const has = useCallback((region: RegionId, concept: string) => visited.has(`${region}/${concept}`), [visited]);
  const share = useCallback(
    (region: RegionId) => {
      const l = LANDMARKS.find((x) => x.id === region);
      if (!l) return 0;
      return l.concepts.filter((c) => visited.has(`${region}/${c.id}`)).length / l.concepts.length;
    },
    [visited],
  );
  const reset = useCallback(() => {
    const empty = new Set<string>();
    write(empty);
    setVisited(empty);
  }, []);

  return { visited, has, share, reset };
}
