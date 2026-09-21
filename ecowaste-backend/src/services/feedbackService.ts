import { query } from '../config/db';

export type FeedbackRow = {
  id: string;
  user_id: string;
  rating: number;
  message: string | null;
  created_at: string;
};

export type AdminFeedbackRow = FeedbackRow & {
  user_name: string | null;
  user_email: string | null;
};

export const createFeedback = async (
  userId: string,
  input: { rating: number; message?: string | null }
): Promise<FeedbackRow> => {
  const res = await query<FeedbackRow>(
    `
      INSERT INTO feedback (user_id, rating, message)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, rating, message, created_at
    `,
    [userId, input.rating, input.message ?? null]
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to save feedback');
  }
  return row;
};

export type PublicTestimonial = {
  author: string;
  role: string | null;
  area: string | null;
  rating: number;
  message: string;
  created_at: string;
};

const toDisplayName = (name: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Anonymous';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
};

export const listPublicTestimonials = async (limit = 6): Promise<PublicTestimonial[]> => {
  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 20 ? limit : 6;
  const res = await query<{
    name: string | null;
    role: string | null;
    area: string | null;
    rating: number;
    message: string;
    created_at: string;
  }>(
    `
      SELECT u.name AS name, u.role AS role, u.area AS area,
             f.rating AS rating, f.message AS message, f.created_at AS created_at
      FROM feedback f
      JOIN users u ON u.id = f.user_id
      WHERE f.rating >= 4
        AND f.message IS NOT NULL
        AND length(trim(f.message)) >= 10
      ORDER BY f.created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );
  return res.rows.map((row) => ({
    author: toDisplayName(row.name),
    role: row.role,
    area: row.area,
    rating: row.rating,
    message: row.message.trim(),
    created_at: String(row.created_at),
  }));
};

export const listFeedback = async (): Promise<AdminFeedbackRow[]> => {
  const res = await query<AdminFeedbackRow>(
    `
      SELECT
        f.id,
        f.user_id,
        u.name AS user_name,
        u.email AS user_email,
        f.rating,
        f.message,
        f.created_at
      FROM feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
      LIMIT 500
    `
  );
  return res.rows;
};
