import { RefreshIcon } from './icons';

export default function ErrorState({
  title,
  description,
  retryLabel = 'Try again',
  onRetry,
}: {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card border-rose-200 bg-rose-50/50 p-6 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-700 ring-1 ring-rose-200">
        <span className="text-base">!</span>
      </div>
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {onRetry ? (
        <button type="button" className="btn btn-outline mt-4" onClick={onRetry}>
          <RefreshIcon className="h-4 w-4" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
