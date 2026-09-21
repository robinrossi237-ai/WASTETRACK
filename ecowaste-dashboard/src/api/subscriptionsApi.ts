import { api } from './axios';

export type Plan = {
  id: string;
  name: string;
  price_amount: number;
  currency: string;
  monthly_limit: number | null;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanInput = {
  id: string;
  name: string;
  price_amount: number;
  currency?: string;
  monthly_limit?: number | null;
  features?: string[];
  is_active?: boolean;
};

export type PlanUpdateInput = {
  name?: string;
  price_amount?: number;
  currency?: string;
  monthly_limit?: number | null;
  features?: string[];
  is_active?: boolean;
};

export type SubscriptionRequestStatus = 'pending' | 'approved' | 'rejected';

export type SubscriptionRequest = {
  id: string;
  user_id: string;
  plan_id: string;
  payment_method: 'mtn' | 'orange';
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
  id: 'mtn' | 'orange';
  name: string;
  merchant_number: string;
  ussd_template: string;
};

export type PaymentSettings = {
  whatsapp_message_template: string;
  mtn_merchant_number: string;
  orange_merchant_number: string;
  mtn_ussd_template: string;
  orange_ussd_template: string;
};

export const subscriptionsApi = {
  listPlans: async (): Promise<Plan[]> => {
    const res = await api.get<{ success: true; plans: Plan[] }>('/admin/plans');
    return res.data.plans;
  },
  createPlan: async (input: PlanInput): Promise<Plan> => {
    const res = await api.post<{ success: true; plan: Plan }>('/admin/plans', input);
    return res.data.plan;
  },
  updatePlan: async (id: string, input: PlanUpdateInput): Promise<Plan> => {
    const res = await api.patch<{ success: true; plan: Plan }>(`/admin/plans/${id}`, input);
    return res.data.plan;
  },
  deletePlan: async (id: string) => {
    const res = await api.delete<{ success: true }>(`/admin/plans/${id}`);
    return res.data;
  },
  listRequests: async (status?: SubscriptionRequestStatus): Promise<SubscriptionRequest[]> => {
    const res = await api.get<{ success: true; requests: SubscriptionRequest[] }>(
      '/admin/subscription-requests',
      { params: status ? { status } : {} }
    );
    return res.data.requests;
  },
  reviewRequest: async (
    id: string,
    input: { decision: 'approved' | 'rejected'; admin_note?: string }
  ): Promise<SubscriptionRequest> => {
    const res = await api.patch<{ success: true; request: SubscriptionRequest }>(
      `/admin/subscription-requests/${id}/review`,
      input
    );
    return res.data.request;
  },
  getPaymentSettings: async (): Promise<{ settings: PaymentSettings; payment_methods: PaymentMethodInfo[] }> => {
    const res = await api.get<{
      success: true;
      settings: PaymentSettings;
      payment_methods: PaymentMethodInfo[];
    }>('/admin/payment-settings');
    return { settings: res.data.settings, payment_methods: res.data.payment_methods };
  },
  updatePaymentSettings: async (input: Partial<PaymentSettings>) => {
    const res = await api.patch<{
      success: true;
      settings: PaymentSettings;
      payment_methods: PaymentMethodInfo[];
    }>('/admin/payment-settings', input);
    return { settings: res.data.settings, payment_methods: res.data.payment_methods };
  }
};
