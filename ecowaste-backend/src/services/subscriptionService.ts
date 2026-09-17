import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PickupQuota, SubscriptionPlan } from '../models/plan';
import { getPlanMonthlyLimit, SUBSCRIPTION_PLANS } from '../models/plan';

export const getUserPlan = async (userId: string): Promise<SubscriptionPlan> => {
  const result = await query<{ subscription_plan: string }>(
    `SELECT subscription_plan FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return 'free';
  return SUBSCRIPTION_PLANS.includes(row.subscription_plan as SubscriptionPlan)
    ? (row.subscription_plan as SubscriptionPlan)
    : 'free';
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
  const limit = getPlanMonthlyLimit(plan);
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