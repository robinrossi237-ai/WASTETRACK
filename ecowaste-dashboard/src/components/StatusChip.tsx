import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300',
  success: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  warning: 'bg-amber-100 text-amber-700 ring-amber-300',
  danger: 'bg-rose-100 text-rose-700 ring-rose-300',
  info: 'bg-sky-100 text-sky-700 ring-sky-300',
};

export default function StatusChip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        toneClass[tone]
      )}
    >
      {icon}
      {label}
    </span>
  );
}
