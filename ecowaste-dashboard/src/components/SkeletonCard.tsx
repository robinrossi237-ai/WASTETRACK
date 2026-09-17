export default function SkeletonCard({
  lines = 3,
}: {
  lines?: number;
}) {
  return (
    <div className="card p-4">
      <div className="animate-pulse space-y-2">
        {Array.from({ length: Math.max(1, lines) }).map((_, idx) => (
          <div
            key={idx}
            className={`h-3 rounded bg-slate-200 ${idx === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
  );
}
