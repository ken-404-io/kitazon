import { useEffect, useRef } from 'react';

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const EVENTS  = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const;

export function useIdleLogout(onLogout: () => void, active: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(onLogout, IDLE_MS);
    };

    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [onLogout, active]);
}
