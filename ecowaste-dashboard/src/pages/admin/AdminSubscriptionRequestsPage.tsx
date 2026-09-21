import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import DataTable, { type Column } from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SkeletonCard from '@/components/SkeletonCard';
import StatusChip from '@/components/StatusChip';
import AdminRefreshPanel from '@/components/AdminRefreshPanel';
import AdminPageHeader from '@/components/AdminPageHeader';
import { getApiErrorMessage } from '@/api/axios';
import { useAdminRealtimeRefresh } from '@/hooks/useAdminRealtimeRefresh';
import {
  subscriptionsApi,
  type SubscriptionRequest,
  type SubscriptionRequestStatus
} from '@/api/subscriptionsApi';
import { CheckIcon, ClipboardIcon, XIcon } from '@/components/icons';

const STATUS_FILTERS: { value: SubscriptionRequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

const STATUS_TONE: Record<SubscriptionRequestStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger'
};

export default function AdminSubscriptionRequestsPage() {
  const [rows, setRows] = useState<SubscriptionRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubscriptionRequestStatus | 'all'>('pending');

  const [reviewTarget, setReviewTarget] = useState<SubscriptionRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [adminNote, setAdminNote] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await subscriptionsApi.listRequests(
        statusFilter === 'all' ? undefined : statusFilter
      );
      setRows(list);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useAdminRealtimeRefresh(() => void load());

  const openReview = (request: SubscriptionRequest, nextDecision: 'approved' | 'rejected') => {
    setReviewTarget(request);
    setDecision(nextDecision);
    setAdminNote('');
  };

  const onReview = async () => {
    if (!reviewTarget) return;
    if (decision === 'rejected' && adminNote.trim().length < 2) {
      toast.error('A reason is required to reject a request.');
      return;
    }
    setIsReviewing(true);
    try {
      const updated = await subscriptionsApi.reviewRequest(reviewTarget.id, {
        decision,
        admin_note: decision === 'rejected' ? adminNote.trim() : adminNote.trim() || undefined
      });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(
        decision === 'approved'
          ? `Plan "${updated.plan_id}" activated for user.`
          : 'Request rejected.'
      );
      setReviewTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsReviewing(false);
    }
  };

  const columns: Column<SubscriptionRequest>[] = useMemo(
    () => [
      {
        header: 'User',
        cell: (r) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">{r.user_name ?? 'Unknown user'}</div>
            {r.user_email ? <div className="text-xs text-slate-500">{r.user_email}</div> : null}
            <div className="text-xs text-slate-500">
              <Link to={`/admin/users?q=${encodeURIComponent(r.user_email ?? r.user_id)}`} className="underline">
                View user
              </Link>
            </div>
          </div>
        )
      },
      {
        header: 'Plan',
        cell: (r) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold capitalize text-slate-900">{r.plan_id}</div>
            <div className="text-xs text-slate-500">
              {r.amount.toLocaleString('fr-FR')} {r.currency} · {r.payment_method === 'mtn' ? 'MTN' : 'Orange'}
            </div>
          </div>
        )
      },
      {
        header: 'Proof',
        cell: (r) =>
          r.proof_url ? (
            <a
              href={r.proof_url}
              target="_blank"
              rel="noreferrer"
              className="block h-16 w-16 overflow-hidden rounded-lg ring-1 ring-slate-200"
              title="Open payment screenshot"
            >
              <img src={r.proof_url} alt="Payment proof" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ) : (
            <span className="text-xs text-slate-400">Free plan</span>
          )
      },
      {
        header: 'Status',
        cell: (r) => <StatusChip label={r.status} tone={STATUS_TONE[r.status]} />
      },
      { header: 'Submitted', cell: (r) => new Date(r.created_at).toLocaleString() },
      {
        header: 'Actions',
        cell: (r) =>
          r.status === 'pending' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-xs text-emerald-700"
                onClick={() => openReview(r, 'approved')}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-xs text-red-600"
                onClick={() => openReview(r, 'rejected')}
              >
                <XIcon className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              {r.reviewed_at ? `Reviewed ${new Date(r.reviewed_at).toLocaleDateString()}` : '—'}
            </span>
          )
      }
    ],
    []
  );

  const pendingCount = rows.filter((row) => row.status === 'pending').length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Subscription Requests"
        subtitle="Review MoMo payment screenshots and activate plans."
        icon={<ClipboardIcon className="h-5 w-5" />}
        tone="amber"
        chips={
          <>
            <StatusChip label={`Shown ${rows.length}`} tone="info" />
            <StatusChip label={`Pending ${pendingCount}`} tone="warning" />
          </>
        }
        footer={
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        }
      />

      <div className="card-solid p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SubscriptionRequestStatus | 'all')}
            className="select w-full sm:w-48"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && rows.length === 0 ? (
        <ErrorState title="Could not load requests" description={loadError} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No requests found"
          description="New MoMo payment requests will appear here."
          actionLabel="Reload"
          onAction={() => void load()}
        />
      ) : (
        <DataTable columns={columns} rows={rows} isLoading={isLoading} emptyMessage="No requests found." />
      )}

      <Modal
        open={reviewTarget !== null}
        title={reviewTarget ? `Review request (${reviewTarget.plan_id})` : 'Review request'}
        tone={decision === 'approved' ? 'success' : 'danger'}
        titleIcon={decision === 'approved' ? <CheckIcon className="h-5 w-5" /> : <XIcon className="h-5 w-5" />}
        onClose={() => setReviewTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={isReviewing}
              onClick={() => void onReview()}
            >
              {isReviewing ? 'Saving...' : decision === 'approved' ? 'Approve & activate' : 'Reject'}
            </button>
          </div>
        }
      >
        {reviewTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">User</div>
                <div className="font-semibold text-slate-900">
                  {reviewTarget.user_name ?? reviewTarget.user_id}
                </div>
                {reviewTarget.user_email && (
                  <div className="text-xs text-slate-500">{reviewTarget.user_email}</div>
                )}
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Payment</div>
                <div className="font-semibold text-slate-900">
                  {reviewTarget.amount.toLocaleString('fr-FR')} {reviewTarget.currency}
                </div>
                <div className="text-xs text-slate-500">
                  {reviewTarget.payment_method === 'mtn' ? 'MTN MoMo' : 'Orange Money'}
                </div>
              </div>
            </div>
            {reviewTarget.proof_url ? (
              <a href={reviewTarget.proof_url} target="_blank" rel="noreferrer" title="Open full size">
                <img
                  src={reviewTarget.proof_url}
                  alt="Payment proof screenshot"
                  className="max-h-80 w-full rounded-xl object-contain ring-1 ring-slate-200"
                />
              </a>
            ) : (
              <p className="text-sm text-slate-500">No screenshot — free plan request.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn flex-1 ${decision === 'approved' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setDecision('approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className={`btn flex-1 ${decision === 'rejected' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setDecision('rejected')}
              >
                Reject
              </button>
            </div>
            <div>
              <label className="label">
                Admin note {decision === 'rejected' ? '(required)' : '(optional)'}
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="field mt-1"
                rows={3}
                placeholder={
                  decision === 'rejected'
                    ? 'Reason shown to the user, e.g. unreadable screenshot'
                    : 'Optional note for the user'
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
