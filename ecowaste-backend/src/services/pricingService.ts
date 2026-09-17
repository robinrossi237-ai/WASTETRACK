import { query } from '../config/db';

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hello {collector_name}, I am tracking my pickup for {pickup_address}.';

export type PricingSettingsRow = {
  scope: string;
  whatsapp_message_template: string;
  updated_at: string | null;
};

const isPgErrorCode = (err: unknown, code: string): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return maybe.code === code;
};

export const getPricingSettings = async (scope = 'default'): Promise<PricingSettingsRow> => {
  try {
    const result = await query<{
      scope: string;
      whatsapp_message_template: string | null;
      updated_at: string | null;
    }>(
      `
        SELECT scope, whatsapp_message_template, updated_at
        FROM app_settings
        WHERE scope = $1
        LIMIT 1
      `,
      [scope]
    );

    const row = result.rows[0];
    if (!row) {
      return {
        scope,
        whatsapp_message_template: DEFAULT_WHATSAPP_TEMPLATE,
        updated_at: null,
      };
    }

    return {
      scope: row.scope,
      whatsapp_message_template: row.whatsapp_message_template?.trim() || DEFAULT_WHATSAPP_TEMPLATE,
      updated_at: row.updated_at,
    };
  } catch (err) {
    // Fallback for environments where migrations have not yet created app_settings.
    if (isPgErrorCode(err, '42P01')) {
      return {
        scope,
        whatsapp_message_template: DEFAULT_WHATSAPP_TEMPLATE,
        updated_at: null,
      };
    }
    throw err;
  }
};
