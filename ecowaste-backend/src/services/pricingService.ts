import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PaymentMethodInfo } from '../models/plan';

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hello {collector_name}, I am tracking my pickup for {pickup_address}.';

export const DEFAULT_MTN_MERCHANT_NUMBER = '652605329';
export const DEFAULT_ORANGE_MERCHANT_NUMBER = '659106128';
export const DEFAULT_MTN_USSD_TEMPLATE = '*126*1*652605329*{amount}#';
export const DEFAULT_ORANGE_USSD_TEMPLATE = '#150*1*659106128*{amount}#';

export type PricingSettingsRow = {
  scope: string;
  whatsapp_message_template: string;
  mtn_merchant_number: string;
  orange_merchant_number: string;
  mtn_ussd_template: string;
  orange_ussd_template: string;
  updated_at: string | null;
};

const isPgErrorCode = (err: unknown, code: string): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return maybe.code === code;
};

const toSettingsRow = (scope: string, row?: Record<string, unknown> | null): PricingSettingsRow => ({
  scope,
  whatsapp_message_template:
    (typeof row?.whatsapp_message_template === 'string' && row.whatsapp_message_template.trim()) ||
    DEFAULT_WHATSAPP_TEMPLATE,
  mtn_merchant_number:
    (typeof row?.mtn_merchant_number === 'string' && row.mtn_merchant_number.trim()) ||
    DEFAULT_MTN_MERCHANT_NUMBER,
  orange_merchant_number:
    (typeof row?.orange_merchant_number === 'string' && row.orange_merchant_number.trim()) ||
    DEFAULT_ORANGE_MERCHANT_NUMBER,
  mtn_ussd_template:
    (typeof row?.mtn_ussd_template === 'string' && row.mtn_ussd_template.trim()) ||
    DEFAULT_MTN_USSD_TEMPLATE,
  orange_ussd_template:
    (typeof row?.orange_ussd_template === 'string' && row.orange_ussd_template.trim()) ||
    DEFAULT_ORANGE_USSD_TEMPLATE,
  updated_at: typeof row?.updated_at === 'string' ? (row.updated_at as string) : null,
});

export const getPricingSettings = async (scope = 'default'): Promise<PricingSettingsRow> => {
  try {
    const result = await query(
      `
        SELECT scope, whatsapp_message_template, mtn_merchant_number, orange_merchant_number,
               mtn_ussd_template, orange_ussd_template, updated_at
        FROM app_settings
        WHERE scope = $1
        LIMIT 1
      `,
      [scope]
    );

    const row = result.rows[0];
    if (!row) {
      return toSettingsRow(scope);
    }

    return toSettingsRow(scope, row);
  } catch (err) {
    // Fallback for environments where migrations have not yet created app_settings.
    if (isPgErrorCode(err, '42P01') || isPgErrorCode(err, '42703')) {
      return toSettingsRow(scope);
    }
    throw err;
  }
};

export const getPaymentMethods = async (scope = 'default'): Promise<PaymentMethodInfo[]> => {
  const settings = await getPricingSettings(scope);
  return [
    {
      id: 'mtn',
      name: 'MTN Mobile Money',
      merchant_number: settings.mtn_merchant_number,
      ussd_template: settings.mtn_ussd_template,
    },
    {
      id: 'orange',
      name: 'Orange Money',
      merchant_number: settings.orange_merchant_number,
      ussd_template: settings.orange_ussd_template,
    },
  ];
};

export type PaymentSettingsUpdate = {
  mtn_merchant_number?: string;
  orange_merchant_number?: string;
  mtn_ussd_template?: string;
  orange_ussd_template?: string;
  whatsapp_message_template?: string;
};

export const updatePaymentSettings = async (
  scope = 'default',
  input: PaymentSettingsUpdate,
): Promise<PricingSettingsRow> => {
  const current = await getPricingSettings(scope);
  const next = {
    whatsapp_message_template: input.whatsapp_message_template?.trim() || current.whatsapp_message_template,
    mtn_merchant_number: input.mtn_merchant_number?.trim() || current.mtn_merchant_number,
    orange_merchant_number: input.orange_merchant_number?.trim() || current.orange_merchant_number,
    mtn_ussd_template: input.mtn_ussd_template?.trim() || current.mtn_ussd_template,
    orange_ussd_template: input.orange_ussd_template?.trim() || current.orange_ussd_template,
  };

  for (const template of [next.mtn_ussd_template, next.orange_ussd_template]) {
    if (!template.includes('{amount}')) {
      throw new HttpError('USSD templates must include {amount}.', 400);
    }
  }

  await query(
    `
      INSERT INTO app_settings
        (scope, whatsapp_message_template, mtn_merchant_number, orange_merchant_number,
         mtn_ussd_template, orange_ussd_template)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (scope) DO UPDATE SET
        whatsapp_message_template = EXCLUDED.whatsapp_message_template,
        mtn_merchant_number = EXCLUDED.mtn_merchant_number,
        orange_merchant_number = EXCLUDED.orange_merchant_number,
        mtn_ussd_template = EXCLUDED.mtn_ussd_template,
        orange_ussd_template = EXCLUDED.orange_ussd_template
    `,
    [
      scope,
      next.whatsapp_message_template,
      next.mtn_merchant_number,
      next.orange_merchant_number,
      next.mtn_ussd_template,
      next.orange_ussd_template,
    ],
  );

  return getPricingSettings(scope);
};
