import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import { listContent } from '../services/adminContentService';
import { listPublicTestimonials } from '../services/feedbackService';

export const listPublicContent: RequestHandler = asyncHandler(async (_req, res) => {
  const content = await listContent();
  res.status(200).json({ success: true, content });
});

const testimonialsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const listPublicTestimonialsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const query = testimonialsQuerySchema.parse(req.query ?? {});
  const testimonials = await listPublicTestimonials(query.limit ?? 6);
  res.status(200).json({ success: true, testimonials });
});
