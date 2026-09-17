import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { listLeaderboard } from '../services/leaderboardService';

const listLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  area: z.string().trim().min(1).optional(),
});

const maskName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  const first = parts[0];
  const last = parts[parts.length - 1] ?? '';
  const lastInitial = last.charAt(0).toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
};

export const publicListLeaderboard: RequestHandler = asyncHandler(async (req, res) => {
  const query = listLeaderboardQuerySchema.parse(req.query);
  const rows = await listLeaderboard({ limit: query.limit ?? 5, area: query.area });

  res.status(200).json({
    success: true,
    leaderboard: rows.map((row) => ({
      ...row,
      name: maskName(row.name),
    })),
  });
});
