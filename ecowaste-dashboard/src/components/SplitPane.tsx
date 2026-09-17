import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import useReducedMotion from '@/hooks/useReducedMotion';

export default function SplitPane({
  left,
  right,
  initialRightWidth = 420,
  minRightWidth = 320,
  maxRightWidth = 560,
  className
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  initialRightWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [rightWidth, setRightWidth] = useState<number>(initialRightWidth);
  const draggingRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = draggingRef.current.startX - e.clientX;
      const next = Math.max(minRightWidth, Math.min(maxRightWidth, draggingRef.current.startWidth + dx));
      setRightWidth(next);
    };

    const onUp = () => {
      draggingRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [minRightWidth, maxRightWidth]);

  return (
    <div className={clsx('relative flex min-h-[460px] w-full overflow-hidden', className)}>
      <div className="min-w-0 flex-1">{left}</div>

      <div
        className={clsx(
          'relative w-2 shrink-0',
          reducedMotion ? 'bg-slate-100' : 'bg-slate-100/70 hover:bg-slate-200',
          'cursor-col-resize'
        )}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={(e) => {
          draggingRef.current = { startX: e.clientX, startWidth: rightWidth };
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'col-resize';
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300/60" />
      </div>

      <div className="shrink-0 border-l border-slate-200 bg-white/60 backdrop-blur" style={{ width: rightWidth }}>
        {right}
      </div>
    </div>
  );
}
