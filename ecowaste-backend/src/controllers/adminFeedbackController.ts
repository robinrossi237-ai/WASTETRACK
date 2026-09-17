import type { RequestHandler } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { listFeedback } from '../services/feedbackService';

export const adminListFeedback: RequestHandler = asyncHandler(async (_req, res) => {
  const feedback = await listFeedback();
  res.status(200).json({ success: true, feedback });
});
