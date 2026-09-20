import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import {
  getPaymentMethods,
  getPricingSettings,
  updatePaymentSettings,
} from '../services/pricingService';
import { listPlans } from '../services/planService';

export const getPublicPricingSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const [settings, plans, paymentMethods] = await Promise.all([
    getPricingSettings('default'),
    listPlans(true),
    getPaymentMethods('default'),
  ]);
  res.status(200).json({
    success: true,
    settings: {
      whatsapp_message_template: settings.whatsapp_message_template,
    },
    plans,
    payment_methods: paymentMethods,
  });
});

const updatePaymentSettingsBodySchema = z.object({
  mtn_merchant_number: z.string().trim().min(3).max(20).optional(),
  orange_merchant_number: z.string().trim().min(3).max(20).optional(),
  mtn_ussd_template: z.string().trim().min(5).max(120).optional(),
  orange_ussd_template: z.string().trim().min(5).max(120).optional(),
  whatsapp_message_template: z.string().trim().min(5).max(1000).optional(),
});

export const adminUpdatePaymentSettings: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user?.id;
  if (!adminId) throw new HttpError('Unauthorized', 401);

  const body = updatePaymentSettingsBodySchema.parse(req.body ?? {});
  if (Object.keys(body).length === 0) {
    throw new HttpError('No fields to update.', 400);
  }
  const settings = await updatePaymentSettings('default', body);
  const paymentMethods = await getPaymentMethods('default');
  res.status(200).json({
    success: true,
    settings: {
      whatsapp_message_template: settings.whatsapp_message_template,
      mtn_merchant_number: settings.mtn_merchant_number,
      orange_merchant_number: settings.orange_merchant_number,
      mtn_ussd_template: settings.mtn_ussd_template,
      orange_ussd_template: settings.orange_ussd_template,
    },
    payment_methods: paymentMethods,
  });
});
