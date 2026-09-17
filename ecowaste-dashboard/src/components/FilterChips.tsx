import clsx from 'clsx';

import { XIcon } from './icons';

export type FilterChip = {
  id: string;
  label: string;
  onClear: () => void;
};

export default function FilterChips({
  chips,
  onClearAll,
  className
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
        >
          <span className="max-w-[240px] truncate">{chip.label}</span>
          <button
            type="button"
            className="grid h-5 w-5 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={chip.onClear}
            aria-label={`Clear ${chip.label}`}
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {onClearAll ? (
        <button type="button" className="btn btn-ghost py-1 text-xs" onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}

