import type { RequestHandler } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { getAdminStats } from '../services/adminStatsService';

export const getStats: RequestHandler = asyncHandler(async (_req, res) => {
  const stats = await getAdminStats();
  res.status(200).json({
    success: true,
    stats,
  });
});
