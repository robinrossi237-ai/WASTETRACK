import clsx from 'clsx';
import { CheckIcon, ClockIcon, TagIcon, XIcon } from '@/components/icons';

const variantForStatus = (status: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' => {
  const s = status.toLowerCase();

  if (['reported', 'pending', 'assigned', 'in_progress'].includes(s)) return 'warning';
  if (['verified', 'approved', 'admin'].includes(s)) return 'info';
  if (['completed', 'cleaned', 'resident'].includes(s)) return 'success';
  if (['overdue', 'rejected', 'cancelled'].includes(s)) return 'danger';
  if (['collector'].includes(s)) return 'neutral';
  if (s.includes('delete') || s.includes('remove') || s.includes('cancel') || s.includes('reject')) return 'danger';
  if (s.includes('create') || s.includes('add')) return 'success';
  if (s.includes('approve') || s.includes('verify')) return 'success';
  if (s.includes('update') || s.includes('edit') || s.includes('change')) return 'info';
  return 'neutral';
};

const classForVariant = (variant: ReturnType<typeof variantForStatus>) => {
  switch (variant) {
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    case 'info':
      return 'bg-sky-50 text-sky-700 ring-sky-600/20';
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'danger':
      return 'bg-rose-50 text-rose-700 ring-rose-600/20';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-600/20';
  }
};

const iconForVariant = (variant: ReturnType<typeof variantForStatus>) => {
  switch (variant) {
    case 'success':
      return CheckIcon;
    case 'danger':
      return XIcon;
    case 'warning':
      return ClockIcon;
    case 'info':
      return TagIcon;
    default:
      return TagIcon;
  }
};

const formatLabel = (status: string): string => {
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function StatusBadge({ status }: { status: string }) {
  const variant = variantForStatus(status);
  const Icon = iconForVariant(variant);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        'select-none whitespace-nowrap',
        classForVariant(variant)
      )}
      title={status}
    >
      <Icon className="h-3.5 w-3.5" />
      {formatLabel(status)}
    </span>
  );
}
