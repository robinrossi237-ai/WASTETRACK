export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200">
        <span className="text-base">i</span>
      </div>
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn-outline mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
