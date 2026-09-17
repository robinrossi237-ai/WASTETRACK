import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from './icons';

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  tone = 'brand',
  titleIcon
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  titleIcon?: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  const toneClasses = useMemo(() => {
    switch (tone) {
      case 'success':
        return {
          accent: 'from-emerald-500 to-teal-500',
          iconWrap: 'bg-emerald-100 text-emerald-700',
          title: 'text-emerald-900'
        };
      case 'warning':
        return {
          accent: 'from-amber-500 to-orange-500',
          iconWrap: 'bg-amber-100 text-amber-700',
          title: 'text-amber-900'
        };
      case 'danger':
        return {
          accent: 'from-rose-500 to-red-500',
          iconWrap: 'bg-rose-100 text-rose-700',
          title: 'text-rose-900'
        };
      case 'neutral':
        return {
          accent: 'from-slate-500 to-slate-700',
          iconWrap: 'bg-slate-100 text-slate-700',
          title: 'text-slate-900'
        };
      default:
        return {
          accent: 'from-brand-500 to-emerald-500',
          iconWrap: 'bg-brand-100 text-brand-700',
          title: 'text-slate-900'
        };
    }
  }, [tone]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mounted, onClose]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <div
        className={`absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          className={`relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] transition-all duration-200 ${visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1.5 scale-[0.985] opacity-0'}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className={`h-1.5 bg-gradient-to-r ${toneClasses.accent}`} />

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {titleIcon ? (
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneClasses.iconWrap}`}>
                  {titleIcon}
                </div>
              ) : null}
              <div className={`truncate text-sm font-semibold ${toneClasses.title}`}>{title}</div>
            </div>
            <button
              type="button"
              className="icon-btn h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

          {footer ? <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
