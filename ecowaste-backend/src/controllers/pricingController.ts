import type { RequestHandler } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { getPricingSettings } from '../services/pricingService';

export const getPublicPricingSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const settings = await getPricingSettings('default');
  res.status(200).json({
    success: true,
    settings: {
      whatsapp_message_template: settings.whatsapp_message_template,
    },
  });
});
