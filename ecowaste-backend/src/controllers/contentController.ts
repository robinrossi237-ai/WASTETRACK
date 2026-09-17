import type { RequestHandler } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { listContent } from '../services/adminContentService';

export const listPublicContent: RequestHandler = asyncHandler(async (_req, res) => {
  const content = await listContent();
  res.status(200).json({ success: true, content });
});
