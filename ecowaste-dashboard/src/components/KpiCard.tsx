import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import useReducedMotion from '@/hooks/useReducedMotion';

export default function KpiCard({
  label,
  value,
  icon,
  accentClassName,
  iconClassName,
  decimals = 0,
  isLoading = false,
  flashToken
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  accentClassName: string;
  iconClassName: string;
  decimals?: number;
  isLoading?: boolean;
  flashToken?: string | number;
}) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(value ?? 0);
  const previous = useRef<number>(value ?? 0);
  const rafId = useRef<number | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (reducedMotion) {
      previous.current = value ?? 0;
      setDisplay(value ?? 0);
      return;
    }

    const from = previous.current;
    const to = value ?? 0;
    previous.current = value ?? 0;

    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) {
      setDisplay(to);
      return;
    }

    const durationMs = 520;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      }
    };

    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(tick);

    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [value, reducedMotion, isLoading]);

  useEffect(() => {
    if (flashToken === undefined) return;
    if (reducedMotion) return;

    setFlashOn(false);
    const t1 = window.setTimeout(() => setFlashOn(true), 0);
    const t2 = window.setTimeout(() => setFlashOn(false), 950);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [flashToken, reducedMotion]);

  const formatted = isLoading ? '—' : value == null ? '—' : display.toFixed(decimals);

  return (
    <div className={clsx('card-solid relative overflow-hidden p-4', flashOn && 'kpi-flash')}>
      <div className={clsx('absolute inset-x-0 top-0 h-1', accentClassName)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {isLoading ? (
              <span className="inline-block h-8 w-24 animate-pulse rounded bg-slate-200 align-middle" />
            ) : (
              formatted
            )}
          </div>
        </div>
        <div className={clsx('grid h-12 w-12 place-items-center rounded-xl ring-1 ring-inset', iconClassName)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
