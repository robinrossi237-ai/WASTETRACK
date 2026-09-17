import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { listCollectorRanking } from '../services/adminCollectorRankingService';

const listCollectorRankingQuerySchema = z.object({
  include_inactive: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
      }
      return value;
    }, z.boolean())
    .optional(),
});

export const adminListCollectorRanking: RequestHandler = asyncHandler(async (req, res) => {
  const query = listCollectorRankingQuerySchema.parse(req.query);
  const ranking = await listCollectorRanking({
    includeInactive: query.include_inactive ?? false,
  });
  res.status(200).json({
    success: true,
    ranking,
  });
});
