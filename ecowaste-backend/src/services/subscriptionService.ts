import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type {
  PaymentMethod,
  PickupQuota,
  SubscriptionRequestRow,
  SubscriptionRequestStatus,
} from '../models/plan';
import { getPlanMonthlyLimit } from '../models/plan';
import { getPlanById } from './planService';
import { setSubscriptionPlan } from './userService';
import { dispatchNotificationCreated } from './notificationsService';

export const getUserPlan = async (userId: string): Promise<string> => {
  const result = await query<{ subscription_plan: string }>(
    `SELECT subscription_plan FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  const planId = row?.subscription_plan?.trim() || 'free';
  const plan = await getPlanById(planId);
  return plan ? plan.id : 'free';
};

/** Monthly pickup limit for a plan, read from the plans table (fallback: hardcoded). */
export const getPlanMonthlyLimitAsync = async (planId: string): Promise<number | null> => {
  const plan = await getPlanById(planId);
  if (plan) return plan.monthly_limit;
  return getPlanMonthlyLimit(planId as 'free');
};

export const countMonthlyPickups = async (userId: string): Promise<number> => {
  const result = await query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM pickup_requests
      WHERE user_id = $1
        AND date_trunc('month', created_at) = date_trunc('month', now())
        AND status <> 'cancelled'
    `,
    [userId],
  );

  return Number(result.rows[0]?.count ?? '0') || 0;
};

export const getPickupQuota = async (userId: string): Promise<PickupQuota> => {
  const [plan, used] = await Promise.all([getUserPlan(userId), countMonthlyPickups(userId)]);
  const limit = await getPlanMonthlyLimitAsync(plan);
  const isUnlimited = limit === null;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);

  return {
    plan,
    limit,
    used,
    remaining: isUnlimited ? 0 : remaining,
    isUnlimited,
  };
};

/**
 * @throws {HttpError} 403 with code `PICKUP_QUOTA_EXCEEDED` when the user has
 * exhausted their monthly quota.
 */
export const assertCanRequestPickup = async (userId: string): Promise<void> => {
  const quota = await getPickupQuota(userId);
  if (quota.isUnlimited) return;
  if (quota.used < quota.limit!) return;

  throw new HttpError(
    `You have reached your monthly pickup limit (${quota.limit}) on the ${quota.plan} plan. Upgrade to a paid plan for unlimited pickups.`,
    403,
    'PICKUP_QUOTA_EXCEEDED',
    {
      plan: quota.plan,
      limit: quota.limit,
      used: quota.used,
      remaining: 0,
    },
  );
};

const REQUEST_COLUMNS = `
  id,
  user_id,
  plan_id,
  payment_method,
  amount,
  currency,
  proof_url,
  status,
  admin_note,
  reviewed_by_admin_id,
  reviewed_at,
  created_at,
  updated_at
`;

const toRequestRow = (row: Record<string, unknown>): SubscriptionRequestRow => ({
  id: String(row.id),
  user_id: String(row.user_id),
  plan_id: String(row.plan_id),
  payment_method: row.payment_method as PaymentMethod,
  amount: Number(row.amount ?? 0),
  currency: String(row.currency ?? 'XOF'),
  proof_url: row.proof_url === null || row.proof_url === undefined ? null : String(row.proof_url),
  status: row.status as SubscriptionRequestStatus,
  admin_note: row.admin_note === null || row.admin_note === undefined ? null : String(row.admin_note),
  reviewed_by_admin_id:
    row.reviewed_by_admin_id === null || row.reviewed_by_admin_id === undefined
      ? null
      : String(row.reviewed_by_admin_id),
  reviewed_at: row.reviewed_at === null || row.reviewed_at === undefined ? null : String(row.reviewed_at),
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? ''),
  user_name: row.user_name === null || row.user_name === undefined ? null : String(row.user_name),
  user_email: row.user_email === null || row.user_email === undefined ? null : String(row.user_email),
});

export const createSubscriptionRequest = async (input: {
  userId: string;
  planId: string;
  paymentMethod: PaymentMethod;
  proofUrl?: string | null;
}): Promise<SubscriptionRequestRow> => {
  const plan = await getPlanById(input.planId);
  if (!plan) {
    throw new HttpError('Plan not found.', 404);
  }
  if (!plan.is_active) {
    throw new HttpError(`Plan "${plan.id}" is not available right now.`, 400);
  }

  const currentPlan = await getUserPlan(input.userId);
  if (currentPlan === plan.id) {
    throw new HttpError(
      `You are already on the ${plan.name} plan.`,
      409,
      'SUBSCRIPTION_ALREADY_ON_PLAN',
    );
  }

  const pending = await query(
    `SELECT id FROM subscription_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [input.userId],
  );
  if (pending.rows[0]) {
    throw new HttpError(
      'You already have a pending subscription request. Wait for admin review.',
      409,
      'SUBSCRIPTION_REQUEST_PENDING',
    );
  }

  // Free plans need no payment: auto-approve immediately.
  if (plan.price_amount === 0) {
    const result = await query(
      `
        INSERT INTO subscription_requests
          (user_id, plan_id, payment_method, amount, currency, proof_url, status, reviewed_at)
        VALUES ($1, $2, $3, 0, $4, NULL, 'approved', now())
        RETURNING ${REQUEST_COLUMNS}
      `,
      [input.userId, plan.id, input.paymentMethod, plan.currency],
    );
    await setSubscriptionPlan(input.userId, plan.id);
    return toRequestRow(result.rows[0]);
  }

  const proofUrl = input.proofUrl?.trim();
  if (!proofUrl) {
    throw new HttpError('A payment screenshot is required for paid plans.', 400);
  }

  const result = await query(
    `
      INSERT INTO subscription_requests
        (user_id, plan_id, payment_method, amount, currency, proof_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING ${REQUEST_COLUMNS}
    `,
    [input.userId, plan.id, input.paymentMethod, plan.price_amount, plan.currency, proofUrl],
  );
  return toRequestRow(result.rows[0]);
};

export const listMySubscriptionRequests = async (userId: string): Promise<SubscriptionRequestRow[]> => {
  const result = await query(
    `SELECT ${REQUEST_COLUMNS} FROM subscription_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return result.rows.map(toRequestRow);
};

export const listSubscriptionRequests = async (status?: SubscriptionRequestStatus): Promise<SubscriptionRequestRow[]> => {
  const result = await query(
    `SELECT sr.id, sr.user_id, sr.plan_id, sr.payment_method, sr.amount, sr.currency,
            sr.proof_url, sr.status, sr.admin_note, sr.reviewed_by_admin_id, sr.reviewed_at,
            sr.created_at, sr.updated_at, u.name AS user_name, u.email AS user_email
     FROM subscription_requests sr
     LEFT JOIN users u ON u.id = sr.user_id ${
      status ? 'WHERE sr.status = $1' : ''
    } ORDER BY sr.created_at DESC LIMIT 200`,
    status ? [status] : [],
  );
  return result.rows.map(toRequestRow);
};

export const reviewSubscriptionRequest = async (input: {
  requestId: string;
  adminId: string;
  decision: 'approved' | 'rejected';
  adminNote?: string | null;
}): Promise<SubscriptionRequestRow> => {
  const existing = await query(
    `SELECT ${REQUEST_COLUMNS} FROM subscription_requests WHERE id = $1 LIMIT 1`,
    [input.requestId],
  );
  const row = existing.rows[0];
  if (!row) {
    throw new HttpError('Subscription request not found.', 404);
  }
  const current = toRequestRow(row);
  if (current.status !== 'pending') {
    throw new HttpError(`Request is already ${current.status}.`, 409, 'SUBSCRIPTION_REQUEST_ALREADY_REVIEWED');
  }

  const note = input.adminNote?.trim() || null;
  if (input.decision === 'rejected' && !note) {
    throw new HttpError('A note is required when rejecting a request.', 400);
  }

  const result = await query(
    `
      UPDATE subscription_requests
      SET status = $2::subscription_request_status,
          admin_note = $3,
          reviewed_by_admin_id = $4,
          reviewed_at = now()
      WHERE id = $1
      RETURNING ${REQUEST_COLUMNS}
    `,
    [current.id, input.decision, note, input.adminId],
  );
  const reviewed = toRequestRow(result.rows[0]);

  if (input.decision === 'approved') {
    await setSubscriptionPlan(current.user_id, current.plan_id);
  }

  try {
    await dispatchNotificationCreated({
      userIds: [current.user_id],
      title: input.decision === 'approved' ? 'Plan approved' : 'Plan request rejected',
      message:
        input.decision === 'approved'
          ? `Your ${current.plan_id} plan is now active.`
          : `Your ${current.plan_id} plan request was rejected.${note ? ` Reason: ${note}` : ''}`,
      path: '/profile/settings',
    });
  } catch (err) {
    console.error('Failed to notify subscription review', err);
  }

  return reviewed;
};
