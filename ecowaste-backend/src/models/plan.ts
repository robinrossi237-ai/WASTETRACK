export const SUBSCRIPTION_PLANS = ['free', 'plus', 'pro'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const isSubscriptionPlan = (value: unknown): value is SubscriptionPlan =>
  typeof value === 'string' && (SUBSCRIPTION_PLANS as readonly string[]).includes(value);

export type PickupQuota = {
  plan: SubscriptionPlan;
  /** Monthly pickup allowance. `null` means unlimited. */
  limit: number | null;
  used: number;
  remaining: number;
  isUnlimited: boolean;
};

export const PICKUP_MONTHLY_LIMITS: Record<SubscriptionPlan, number | null> = {
  free: 3,
  plus: null,
  pro: null,
};

export const getPlanMonthlyLimit = (plan: SubscriptionPlan): number | null =>
  PICKUP_MONTHLY_LIMITS[plan] ?? null;