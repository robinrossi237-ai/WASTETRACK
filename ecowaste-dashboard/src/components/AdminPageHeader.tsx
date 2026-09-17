import type { ReactNode } from 'react';
import clsx from 'clsx';

type HeaderTone = 'brand' | 'sky' | 'emerald' | 'amber' | 'slate';

const TONE_CLASS: Record<HeaderTone, string> = {
  brand: 'from-brand-500/15 via-brand-400/10 to-emerald-400/10',
  sky: 'from-slate-500/15 via-slate-400/10 to-brand-400/10',
  emerald: 'from-emerald-500/15 via-brand-500/10 to-brand-300/10',
  amber: 'from-amber-500/15 via-orange-500/10 to-rose-500/10',
  slate: 'from-slate-500/15 via-slate-400/10 to-brand-400/10'
};

export default function AdminPageHeader({
  title,
  subtitle,
  icon,
  chips,
  actions,
  footer,
  tone = 'brand'
}: {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: HeaderTone;
}) {
  return (
    <section className="card-solid overflow-hidden border border-slate-200 p-0">
      <div className={clsx('bg-gradient-to-r p-4 sm:p-5', TONE_CLASS[tone])}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
              {icon ? <span className="text-brand-700">{icon}</span> : null}
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-700">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {chips ? <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div> : null}
      </div>
      {footer ? <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5">{footer}</div> : null}
    </section>
  );
}

