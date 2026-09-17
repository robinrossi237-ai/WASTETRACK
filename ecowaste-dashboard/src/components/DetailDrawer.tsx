import { useEffect } from 'react';
import clsx from 'clsx';

import useReducedMotion from '@/hooks/useReducedMotion';
import { XIcon } from './icons';

export default function DetailDrawer({
  open,
  title,
  onClose,
  children,
  footer,
  widthClassName = 'w-full sm:w-[420px]'
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
}) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={clsx(
        'fixed inset-0 z-40',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      aria-hidden={!open}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
          !reducedMotion && 'motion-safe:duration-200'
        )}
        onClick={onClose}
      />

      <div
        className={clsx(
          'absolute right-0 top-0 h-full',
          widthClassName,
          'bg-white shadow-2xl ring-1 ring-slate-200',
          'flex flex-col',
          'transition-transform',
          open ? 'translate-x-0' : 'translate-x-full',
          !reducedMotion && 'motion-safe:duration-200'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

