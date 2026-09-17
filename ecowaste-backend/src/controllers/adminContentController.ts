import type { RequestHandler } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../utils/asyncHandler';
import {
  createContent,
  deleteContent,
  listContent,
  updateContent,
} from '../services/adminContentService';
import { HttpError } from '../middlewares/errorHandler';

const contentBodySchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  media_url: z.string().trim().min(1).url().nullable().optional(),
});

const contentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const adminListContent: RequestHandler = asyncHandler(async (_req, res) => {
  const content = await listContent();
  res.status(200).json({ success: true, content });
});

export const adminCreateContent: RequestHandler = asyncHandler(async (req, res) => {
  const body = contentBodySchema.parse(req.body);
  const adminId = req.user?.id;
  if (!adminId) {
    throw new HttpError('Unauthorized', 401);
  }

  const content = await createContent({
    title: body.title,
    body: body.body,
    mediaUrl: body.media_url ?? null,
    adminId,
  });

  res.status(201).json({ success: true, content });
});

export const adminUpdateContent: RequestHandler = asyncHandler(async (req, res) => {
  const params = contentIdParamsSchema.parse(req.params);
  const body = contentBodySchema.parse(req.body);

  const content = await updateContent(params.id, {
    title: body.title,
    body: body.body,
    mediaUrl: body.media_url ?? null,
  });

  res.status(200).json({ success: true, content });
});

export const adminDeleteContent: RequestHandler = asyncHandler(async (req, res) => {
  const params = contentIdParamsSchema.parse(req.params);
  await deleteContent(params.id);
  res.status(200).json({ success: true });
});
