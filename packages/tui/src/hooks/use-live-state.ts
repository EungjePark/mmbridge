import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { getLiveStatePath } from '@mmbridge/core';
import type { LiveState } from '@mmbridge/core';
import { useEffect, useRef, useState } from 'react';

export function useLiveState(pollMs = 500): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null);
  const pathRef = useRef(getLiveStatePath());

  useEffect(() => {
    const livePath = pathRef.current;
    let cancelled = false;

    const read = async () => {
      // Fast-path: skip read + parse when file doesn't exist (common idle case)
      if (!existsSync(livePath)) {
        setState(null);
        return;
      }
      try {
        const raw = await readFile(livePath, 'utf8');
        if (cancelled) return;
        const parsed = JSON.parse(raw) as LiveState;
        setState(parsed.active ? parsed : null);
      } catch {
        if (!cancelled) setState(null);
      }
    };

    read();
    const interval = setInterval(read, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollMs]);

  return state;
}
