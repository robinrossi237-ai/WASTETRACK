import type { RequestHandler } from 'express';
import { z } from 'zod';

import { REWARD_REASONS } from '../models/enums';
import { asyncHandler } from '../utils/asyncHandler';
import { grantReward, listRewards } from '../services/adminRewardsService';

const listRewardsQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  reason: z.enum(REWARD_REASONS).optional(),
});

const grantRewardBodySchema = z.object({
  user_id: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  reason: z.enum(REWARD_REASONS).default('bonus'),
  related_entity_id: z.string().uuid().optional(),
});

export const adminListRewards: RequestHandler = asyncHandler(async (req, res) => {
  const query = listRewardsQuerySchema.parse(req.query);
  const rewards = await listRewards({ userId: query.user_id, reason: query.reason });
  res.status(200).json({ success: true, rewards });
});

export const adminGrantReward: RequestHandler = asyncHandler(async (req, res) => {
  const body = grantRewardBodySchema.parse(req.body);

  await grantReward({
    userId: body.user_id,
    points: body.points,
    reason: body.reason,
    relatedEntityId: body.related_entity_id,
  });

  res.status(201).json({ success: true });
});
