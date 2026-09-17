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
