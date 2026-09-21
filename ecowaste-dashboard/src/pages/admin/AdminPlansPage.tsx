import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

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
import { subscriptionsApi, type PaymentSettings, type Plan } from '@/api/subscriptionsApi';
import { PencilIcon, PlusIcon, TagIcon, TrashIcon } from '@/components/icons';

type PlanFormState = {
  id: string;
  name: string;
  price_amount: string;
  currency: string;
  monthly_limit: string;
  unlimited: boolean;
  featuresText: string;
  is_active: boolean;
};

const emptyForm: PlanFormState = {
  id: '',
  name: '',
  price_amount: '0',
  currency: 'XOF',
  monthly_limit: '',
  unlimited: true,
  featuresText: '',
  is_active: true
};

const formatPrice = (plan: Plan) =>
  plan.price_amount === 0 ? 'Free' : `${plan.price_amount.toLocaleString('fr-FR')} ${plan.currency}`;

export default function AdminPlansPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<PaymentSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [plans, payment] = await Promise.all([
        subscriptionsApi.listPlans(),
        subscriptionsApi.getPaymentSettings()
      ]);
      setRows(plans);
      setSettings(payment.settings);
      setSettingsDraft(payment.settings);
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

  useAdminRealtimeRefresh(() => void load());

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      id: plan.id,
      name: plan.name,
      price_amount: String(plan.price_amount),
      currency: plan.currency,
      monthly_limit: plan.monthly_limit === null ? '' : String(plan.monthly_limit),
      unlimited: plan.monthly_limit === null,
      featuresText: plan.features.join('\n'),
      is_active: plan.is_active
    });
    setModalOpen(true);
  };

  const parseForm = () => {
    const price = Number(form.price_amount);
    const limit = form.unlimited || form.monthly_limit.trim() === '' ? null : Number(form.monthly_limit);
    const features = form.featuresText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { price, limit, features };
  };

  const onSave = async () => {
    const { price, limit, features } = parseForm();
    if (!form.name.trim()) {
      toast.error('Plan name is required.');
      return;
    }
    if (!Number.isInteger(price) || price < 0) {
      toast.error('Price must be a positive whole number (FCFA).');
      return;
    }
    if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
      toast.error('Monthly limit must be a positive whole number or unlimited.');
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        const updated = await subscriptionsApi.updatePlan(editing.id, {
          name: form.name.trim(),
          price_amount: price,
          currency: form.currency.trim().toUpperCase() || 'XOF',
          monthly_limit: limit,
          features,
          is_active: form.is_active
        });
        setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        toast.success(`Plan "${updated.name}" updated.`);
      } else {
        if (!/^[a-z0-9-]{2,32}$/.test(form.id.trim().toLowerCase())) {
          toast.error('Plan id must be a 2-32 char slug (letters, digits, dashes).');
          setIsSaving(false);
          return;
        }
        const created = await subscriptionsApi.createPlan({
          id: form.id.trim().toLowerCase(),
          name: form.name.trim(),
          price_amount: price,
          currency: form.currency.trim().toUpperCase() || 'XOF',
          monthly_limit: limit,
          features,
          is_active: form.is_active
        });
        setRows((prev) => [...prev, created].sort((a, b) => a.price_amount - b.price_amount));
        toast.success(`Plan "${created.name}" created.`);
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await subscriptionsApi.deletePlan(deleteTarget.id);
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      toast.success(`Plan "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const onToggleActive = async (plan: Plan) => {
    try {
      const updated = await subscriptionsApi.updatePlan(plan.id, { is_active: !plan.is_active });
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`Plan "${updated.name}" ${updated.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const onSaveSettings = async () => {
    if (!settingsDraft) return;
    setIsSavingSettings(true);
    try {
      const { settings: saved } = await subscriptionsApi.updatePaymentSettings({
        mtn_merchant_number: settingsDraft.mtn_merchant_number,
        orange_merchant_number: settingsDraft.orange_merchant_number,
        mtn_ussd_template: settingsDraft.mtn_ussd_template,
        orange_ussd_template: settingsDraft.orange_ussd_template
      });
      setSettings(saved);
      setSettingsDraft(saved);
      toast.success('Payment settings saved.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const columns: Column<Plan>[] = useMemo(
    () => [
      {
        header: 'Plan',
        cell: (p) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">{p.name}</div>
            <div className="font-mono text-xs text-slate-500">{p.id}</div>
          </div>
        )
      },
      {
        header: 'Price',
        cell: (p) => <span className="text-sm font-semibold text-slate-900">{formatPrice(p)}</span>
      },
      {
        header: 'Monthly limit',
        cell: (p) => (
          <span className="text-sm text-slate-700">
            {p.monthly_limit === null ? 'Unlimited' : `${p.monthly_limit} pickups`}
          </span>
        )
      },
      {
        header: 'Status',
        cell: (p) => (
          <StatusChip label={p.is_active ? 'Active' : 'Inactive'} tone={p.is_active ? 'success' : 'neutral'} />
        )
      },
      {
        header: 'Actions',
        cell: (p) => (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => openEdit(p)}>
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost px-3 py-1 text-xs"
              onClick={() => void onToggleActive(p)}
              disabled={p.id === 'free'}
              title={p.id === 'free' ? 'The free plan stays active' : undefined}
            >
              {p.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              className="btn btn-ghost px-3 py-1 text-xs text-red-600"
              onClick={() => setDeleteTarget(p)}
              disabled={p.id === 'free'}
              title={p.id === 'free' ? 'The free plan cannot be deleted' : undefined}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const activeCount = rows.filter((row) => row.is_active).length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Subscription Plans"
        subtitle="Create plans, set prices and limits. Changes apply to the mobile app immediately."
        icon={<TagIcon className="h-5 w-5" />}
        tone="brand"
        chips={
          <>
            <StatusChip label={`Plans ${rows.length}`} tone="info" />
            <StatusChip label={`Active ${activeCount}`} tone="success" />
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            New plan
          </button>
        }
        footer={
          <AdminRefreshPanel
            isLoading={isLoading}
            lastRefreshedAt={lastRefreshedAt}
            onRetryAll={() => void load()}
          />
        }
      />

      {isLoading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : loadError && rows.length === 0 ? (
        <ErrorState title="Could not load plans" description={loadError} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create your first subscription plan."
          actionLabel="New plan"
          onAction={openCreate}
        />
      ) : (
        <DataTable columns={columns} rows={rows} isLoading={isLoading} emptyMessage="No plans found." />
      )}

      <div className="card-solid space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">MoMo payment settings</h2>
          <p className="text-sm text-slate-500">
            Merchant numbers and USSD codes shown in the mobile app. Templates must include {'{amount}'}.
          </p>
        </div>
        {settingsDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">MTN merchant number</label>
              <input
                value={settingsDraft.mtn_merchant_number}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, mtn_merchant_number: e.target.value })}
                className="field mt-1"
              />
            </div>
            <div>
              <label className="label">Orange merchant number</label>
              <input
                value={settingsDraft.orange_merchant_number}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, orange_merchant_number: e.target.value })}
                className="field mt-1"
              />
            </div>
            <div>
              <label className="label">MTN USSD template</label>
              <input
                value={settingsDraft.mtn_ussd_template}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, mtn_ussd_template: e.target.value })}
                className="field mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="label">Orange USSD template</label>
              <input
                value={settingsDraft.orange_ussd_template}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, orange_ussd_template: e.target.value })}
                className="field mt-1 font-mono text-sm"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Payment settings unavailable.</p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-secondary disabled:opacity-60"
            disabled={!settingsDraft || isSavingSettings}
            onClick={() => void onSaveSettings()}
          >
            {isSavingSettings ? 'Saving...' : 'Save payment settings'}
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit plan "${editing.name}"` : 'New plan'}
        tone="brand"
        titleIcon={<TagIcon className="h-5 w-5" />}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={isSaving}
              onClick={() => void onSave()}
            >
              {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {!editing && (
            <div>
              <label className="label">Plan id (slug)</label>
              <input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })}
                className="field mt-1 font-mono"
                placeholder="e.g. family"
              />
            </div>
          )}
          <div>
            <label className="label">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field mt-1"
              placeholder="e.g. Family"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price (FCFA)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.price_amount}
                onChange={(e) => setForm({ ...form, price_amount: e.target.value })}
                className="field mt-1"
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                className="field mt-1"
                maxLength={3}
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.unlimited}
                onChange={(e) => setForm({ ...form, unlimited: e.target.checked })}
                className="h-4 w-4"
              />
              Unlimited monthly pickups
            </label>
            {!form.unlimited && (
              <input
                type="number"
                min={1}
                step={1}
                value={form.monthly_limit}
                onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
                className="field mt-2"
                placeholder="Monthly pickup limit"
              />
            )}
          </div>
          <div>
            <label className="label">Advantages (one per line)</label>
            <textarea
              value={form.featuresText}
              onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              className="field mt-1"
              rows={4}
              placeholder={'Ramassages illimités\nSupport prioritaire'}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4"
            />
            Active (visible in the app)
          </label>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title={deleteTarget ? `Delete plan "${deleteTarget.name}"?` : 'Delete plan'}
        tone="danger"
        titleIcon={<TrashIcon className="h-5 w-5" />}
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary disabled:opacity-60"
              disabled={isDeleting}
              onClick={() => void onDelete()}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          This permanently removes the plan. Plans assigned to users cannot be deleted — deactivate them
          instead.
        </p>
      </Modal>
    </div>
  );
}
