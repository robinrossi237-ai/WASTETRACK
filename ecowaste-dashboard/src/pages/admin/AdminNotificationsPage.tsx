import { useState } from 'react';
import toast from 'react-hot-toast';

import { notificationsApi } from '@/api/notificationsApi';
import { getApiErrorMessage } from '@/api/axios';
import AdminPageHeader from '@/components/AdminPageHeader';
import StatusChip from '@/components/StatusChip';
import { MegaphoneIcon } from '@/components/icons';

export default function AdminNotificationsPage() {
  const [message, setMessage] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [role, setRole] = useState<'all' | 'resident' | 'collector' | 'admin'>('all');
  const [isSending, setIsSending] = useState<boolean>(false);

  const send = async () => {
    if (!message.trim()) {
      toast.error('Message is required');
      return;
    }
    setIsSending(true);
    try {
      const res = await notificationsApi.broadcast({
        message: message.trim(),
        area: area.trim() || undefined,
        role: role === 'all' ? undefined : role
      });
      toast.success(`Sent to ${res.sent} user(s)`);
      setMessage('');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Broadcast Center"
        subtitle="Send operational updates to residents, collectors, or all users."
        icon={<MegaphoneIcon className="h-5 w-5" />}
        tone="sky"
        chips={(
          <>
            <StatusChip label={`Target ${role}`} tone="info" />
            <StatusChip label={`Message ${message.length}/500`} tone={message.length > 450 ? 'warning' : 'neutral'} />
            {area.trim() ? <StatusChip label={`Area ${area.trim()}`} tone="success" /> : null}
          </>
        )}
      />

      <div className="card-solid p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="label">Target role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="select w-full"
            >
              <option value="all">All users</option>
              <option value="resident">Residents</option>
              <option value="collector">Collectors</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="label">Area (optional)</label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Bonaberi, Douala"
              className="field"
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <label className="label">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={500}
            className="field"
            placeholder="Keep it concise and actionable"
          />
          <div className="text-right text-xs text-slate-500">{message.length}/500</div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn btn-primary disabled:opacity-60"
            onClick={() => void send()}
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send broadcast'}
          </button>
        </div>
      </div>
    </div>
  );
}
