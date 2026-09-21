import { apiRequest } from "@/lib/api-client";
import { uploadMediaUri } from "@/lib/media-upload";
import type {
  PaymentMethodDetails,
  PaymentMethodId,
  PlanDetails,
  SubscriptionRequestDetails,
} from "@/lib/types";

export const fetchPricing = async (): Promise<{
  plans: PlanDetails[];
  paymentMethods: PaymentMethodDetails[];
}> => {
  const data = await apiRequest<{
    success: true;
    plans: PlanDetails[];
    payment_methods: PaymentMethodDetails[];
  }>("GET", "/pricing");
  return {
    plans: Array.isArray(data.plans) ? data.plans : [],
    paymentMethods: Array.isArray(data.payment_methods) ? data.payment_methods : [],
  };
};

export const createSubscriptionRequest = async (input: {
  planId: string;
  paymentMethod: PaymentMethodId;
  proofUrl?: string | null;
}): Promise<SubscriptionRequestDetails> => {
  const data = await apiRequest<{ success: true; request: SubscriptionRequestDetails }>(
    "POST",
    "/resident/subscription-requests",
    {
      plan_id: input.planId,
      payment_method: input.paymentMethod,
      ...(input.proofUrl ? { proof_url: input.proofUrl } : {}),
    }
  );
  return data.request;
};

export const listMySubscriptionRequests = async (): Promise<SubscriptionRequestDetails[]> => {
  const data = await apiRequest<{ success: true; requests: SubscriptionRequestDetails[] }>(
    "GET",
    "/resident/subscription-requests"
  );
  return Array.isArray(data.requests) ? data.requests : [];
};

export const uploadPaymentProof = async (dataUri: string): Promise<string> =>
  uploadMediaUri(dataUri, { category: "subscription-proof" });

/** Build a `tel:` URL from a USSD template (`{amount}` placeholder, `#` encoded). */
export const buildUssdDialUrl = (template: string, amount: number): string => {
  const ussd = template.replace("{amount}", String(amount)).replace(/#/g, "%23");
  return `tel:${ussd}`;
};

export const formatPrice = (amount: number, currency: string): string =>
  `${Number(amount).toLocaleString("fr-FR")} ${currency}`;
