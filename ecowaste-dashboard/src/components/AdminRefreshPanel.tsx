import { useEffect, useState } from 'react';

import { RefreshIcon } from './icons';

type AdminRefreshPanelProps = {
  isLoading?: boolean;
  lastRefreshedAt: string | null;
  onRetryAll: () => void;
};

const formatLastRefreshed = (value: string | null) => {
  if (!value) return 'Last refreshed: not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last refreshed: unknown';
  return `Last refreshed: ${date.toLocaleString()}`;
};

export default function AdminRefreshPanel({
  isLoading = false,
  lastRefreshedAt,
  onRetryAll
}: AdminRefreshPanelProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsOnline(true);
      return;
    }
    const update = () => setIsOnline(window.navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
          isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {isOnline ? 'Live' : 'Offline'}
      </span>
      <span className="text-xs text-slate-500">{formatLastRefreshed(lastRefreshedAt)}</span>
      <button
        type="button"
        className="btn btn-outline py-1.5"
        onClick={onRetryAll}
        disabled={isLoading}
      >
        <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        Retry all
      </button>
    </div>
  );
}
