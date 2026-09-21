export const SUBSCRIPTION_PLANS = ['free', 'plus', 'pro'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const isSubscriptionPlan = (value: unknown): value is SubscriptionPlan =>
  typeof value === 'string' && (SUBSCRIPTION_PLANS as readonly string[]).includes(value);

export type PickupQuota = {
  /** Plan id (dynamic, see plans table). */
  plan: string;
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

export const PAYMENT_METHODS = ['mtn', 'orange'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SUBSCRIPTION_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type SubscriptionRequestStatus = (typeof SUBSCRIPTION_REQUEST_STATUSES)[number];

export type PlanRow = {
  id: string;
  name: string;
  price_amount: number;
  currency: string;
  /** Monthly pickup allowance. `null` means unlimited. */
  monthly_limit: number | null;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRequestRow = {
  id: string;
  user_id: string;
  plan_id: string;
  payment_method: PaymentMethod;
  amount: number;
  currency: string;
  proof_url: string | null;
  status: SubscriptionRequestStatus;
  admin_note: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

export type PaymentMethodInfo = {
  id: PaymentMethod;
  name: string;
  merchant_number: string;
  ussd_template: string;
};