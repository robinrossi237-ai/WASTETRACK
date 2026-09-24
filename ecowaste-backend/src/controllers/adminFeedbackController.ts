import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { listFeedback, setFeedbackVisibility } from '../services/feedbackService';

export const adminListFeedback: RequestHandler = asyncHandler(async (_req, res) => {
  const feedback = await listFeedback();
  res.status(200).json({ success: true, feedback });
});

const visibilityParamsSchema = z.object({
  id: z.string().uuid(),
});

const visibilityBodySchema = z.object({
  is_visible: z.boolean(),
});

export const adminSetFeedbackVisibility: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user?.id;
  if (!adminId) throw new HttpError('Unauthorized', 401);

  const params = visibilityParamsSchema.parse(req.params);
  const body = visibilityBodySchema.parse(req.body ?? {});
  const feedback = await setFeedbackVisibility(params.id, body.is_visible);
  res.status(200).json({ success: true, feedback });
});
