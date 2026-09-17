import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';

export type EducationContentRow = {
  id: string;
  title: string;
  body: string;
  media_url: string | null;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

export const listContent = async (): Promise<EducationContentRow[]> => {
  const res = await query<EducationContentRow>(
    `
      SELECT id, title, body, media_url, created_by_admin_id, created_at, updated_at
      FROM education_content
      ORDER BY updated_at DESC
      LIMIT 500
    `
  );
  return res.rows;
};

export const createContent = async (input: {
  title: string;
  body: string;
  mediaUrl?: string | null;
  adminId: string;
}): Promise<EducationContentRow> => {
  const res = await query<EducationContentRow>(
    `
      INSERT INTO education_content (title, body, media_url, created_by_admin_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, body, media_url, created_by_admin_id, created_at, updated_at
    `,
    [input.title, input.body, input.mediaUrl ?? null, input.adminId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to create content');
  }

  return row;
};

export const updateContent = async (
  id: string,
  input: {
    title: string;
    body: string;
    mediaUrl?: string | null;
  }
): Promise<EducationContentRow> => {
  const res = await query<EducationContentRow>(
    `
      UPDATE education_content
      SET title = $2,
          body = $3,
          media_url = $4
      WHERE id = $1
      RETURNING id, title, body, media_url, created_by_admin_id, created_at, updated_at
    `,
    [id, input.title, input.body, input.mediaUrl ?? null]
  );

  const row = res.rows[0];
  if (!row) {
    throw new HttpError('Content not found', 404);
  }

  return row;
};

export const deleteContent = async (id: string): Promise<void> => {
  const res = await query<{ id: string }>(
    `
      DELETE FROM education_content
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  if (!res.rows[0]) {
    throw new HttpError('Content not found', 404);
  }
};
