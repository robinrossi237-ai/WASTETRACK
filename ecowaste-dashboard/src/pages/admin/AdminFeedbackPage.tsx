import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import DataTable, { type Column } from '@/components/DataTable';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import SkeletonCard from '@/components/SkeletonCard';
import StatusChip from '@/components/StatusChip';
import { getApiErrorMessage } from '@/api/axios';
import { feedbackApi, type Feedback } from '@/api/feedbackApi';
import { ClipboardIcon, MessageIcon, SearchIcon } from '@/components/icons';

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const copyToClipboard = useCallback(async (value: string, label = 'ID') => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await feedbackApi.listFeedback();
      setRows(list);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((f) => {
      if (ratingFilter !== 'all' && f.rating !== ratingFilter) return false;
      const ts = new Date(f.created_at).getTime();
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (!Number.isNaN(fromTs) && ts < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        if (!Number.isNaN(toTs) && ts > toTs + 86_399_000) return false;
      }
      if (!q) return true;
      const haystack = [
        f.id,
        f.user_id,
        f.user_name ?? '',
        f.user_email ?? '',
        f.message ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, ratingFilter, fromDate, toDate]);

  const positiveCount = useMemo(() => rows.filter((item) => item.rating >= 4).length, [rows]);
  const criticalCount = useMemo(() => rows.filter((item) => item.rating <= 2).length, [rows]);
  const averageRating = useMemo(() => {
    if (rows.length === 0) return 0;
    const total = rows.reduce((sum, item) => sum + item.rating, 0);
    return total / rows.length;
  }, [rows]);

  const resetFilters = () => {
    setQuery('');
    setRatingFilter('all');
    setFromDate('');
    setToDate('');
  };

  const columns: Column<Feedback>[] = useMemo(
    () => [
      {
        header: 'User',
        cell: (f) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">
              {f.user_name ?? 'Unknown user'}
            </div>
            {f.user_email ? <div className="text-xs text-slate-500">{f.user_email}</div> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{f.user_id}</span>
              <button
                type="button"
                className="icon-btn h-6 w-6"
                onClick={() => void copyToClipboard(f.user_id, 'User ID')}
                aria-label="Copy user ID"
              >
                <ClipboardIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      },
      {
        header: 'Rating',
        cell: (f) => (
          <div className="text-base font-semibold text-slate-900">
            {f.rating} / 5
          </div>
        )
      },
      {
        header: 'Message',
        cell: (f) => {
          const text = f.message?.trim() || 'No message';
          const clipped = text.length > 160 ? `${text.slice(0, 160)}...` : text;
          return <div className="text-sm text-slate-700">{clipped}</div>;
        }
      },
      { header: 'Created', cell: (f) => new Date(f.created_at).toLocaleString() },
      {
        header: 'Actions',
        cell: (f) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost px-3 py-1 text-xs"
              onClick={() => void copyToClipboard(f.id, 'Feedback ID')}
            >
              Copy feedback ID
            </button>
          </div>
        )
      }
    ],
    [copyToClipboard]
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Feedback & Ratings"
        subtitle="Review resident feedback and satisfaction trends."
        icon={<MessageIcon className="h-5 w-5" />}
        tone="amber"
        chips={(
          <>
            <StatusChip label={`Entries ${rows.length}`} tone="info" />
            <StatusChip label={`Avg ${averageRating.toFixed(1)}/5`} tone="neutral" />
            <StatusChip label={`Positive ${positiveCount}`} tone="success" />
            <StatusChip label={`Critical ${criticalCount}`} tone={criticalCount > 0 ? 'danger' : 'neutral'} />
          </>
        )}
        actions={(
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
            <MessageIcon className="h-4 w-4" />
            Resident input
          </div>
        )}
        footer={(
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        )}
      />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search feedback"
              className="field w-full pl-9 sm:w-56"
            />
          </div>
          <select
            value={ratingFilter}
            onChange={(e) => {
              const next = e.target.value;
              setRatingFilter(next === 'all' ? 'all' : Number(next));
            }}
            className="select w-full sm:w-40"
          >
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <input
            type="date"
            className="field w-36"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            className="field w-36"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && rows.length === 0 ? (
        <ErrorState
          title="Could not load feedback"
          description={loadError}
          onRetry={() => void load()}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="No feedback found"
          description="Try widening the date range or removing filters."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <DataTable columns={columns} rows={filteredRows} isLoading={isLoading} emptyMessage="No feedback yet." />
      )}
    </div>
  );
}
