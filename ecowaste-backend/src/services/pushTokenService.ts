import { query } from '../config/db';

export type PushPlatform = 'ios' | 'android' | 'web';

export type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: PushPlatform;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export const upsertPushToken = async (input: {
  userId: string;
  token: string;
  platform: PushPlatform;
}): Promise<void> => {
  await query(
    `
      INSERT INTO push_tokens (user_id, token, platform, is_active, last_seen_at)
      VALUES ($1, $2, $3, true, now())
      ON CONFLICT (token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          is_active = true,
          last_seen_at = now()
    `,
    [input.userId, input.token, input.platform]
  );
};

export const deactivatePushToken = async (userId: string, token: string): Promise<void> => {
  await query(
    `
      UPDATE push_tokens
      SET is_active = false
      WHERE user_id = $1
        AND token = $2
    `,
    [userId, token]
  );
};

export const deactivatePushTokenByToken = async (token: string): Promise<void> => {
  await query(
    `
      UPDATE push_tokens
      SET is_active = false
      WHERE token = $1
    `,
    [token]
  );
};

export const listActivePushTokensForUsers = async (userIds: string[]): Promise<PushTokenRow[]> => {
  if (userIds.length === 0) {
    return [];
  }

  const dedupedUserIds = Array.from(new Set(userIds.map((value) => value.trim()).filter(Boolean)));
  if (dedupedUserIds.length === 0) {
    return [];
  }

  const res = await query<PushTokenRow>(
    `
      SELECT id, user_id, token, platform, is_active, last_seen_at, created_at, updated_at
      FROM push_tokens
      WHERE is_active = true
        AND user_id = ANY($1::uuid[])
    `,
    [dedupedUserIds]
  );

  return res.rows;
};
