import { query } from '../config/db';
import { HttpError } from '../middlewares/errorHandler';
import type { PlanRow } from '../models/plan';

export type PlanInput = {
  id: string;
  name: string;
  price_amount: number;
  currency?: string;
  monthly_limit?: number | null;
  features?: string[];
  is_active?: boolean;
};

export type PlanUpdateInput = {
  name?: string;
  price_amount?: number;
  currency?: string;
  monthly_limit?: number | null;
  features?: string[];
  is_active?: boolean;
};

const PLAN_COLUMNS = `
  id,
  name,
  price_amount,
  currency,
  monthly_limit,
  features,
  is_active,
  created_at,
  updated_at
`;

const toPlanRow = (row: Record<string, unknown>): PlanRow => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  price_amount: Number(row.price_amount ?? 0),
  currency: String(row.currency ?? 'XOF'),
  monthly_limit: row.monthly_limit === null || row.monthly_limit === undefined ? null : Number(row.monthly_limit),
  features: Array.isArray(row.features) ? (row.features as unknown[]).map(String) : [],
  is_active: Boolean(row.is_active),
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? ''),
});

export const listPlans = async (activeOnly = false): Promise<PlanRow[]> => {
  const result = await query(
    `SELECT ${PLAN_COLUMNS} FROM plans ${activeOnly ? 'WHERE is_active = true' : ''} ORDER BY price_amount ASC, id ASC`,
  );
  return result.rows.map(toPlanRow);
};

export const getPlanById = async (id: string): Promise<PlanRow | null> => {
  const result = await query(`SELECT ${PLAN_COLUMNS} FROM plans WHERE id = $1 LIMIT 1`, [id.trim().toLowerCase()]);
  const row = result.rows[0];
  return row ? toPlanRow(row) : null;
};

export const createPlan = async (input: PlanInput): Promise<PlanRow> => {
  const id = input.id.trim().toLowerCase();
  const existing = await getPlanById(id);
  if (existing) {
    throw new HttpError(`A plan with id "${id}" already exists.`, 409, 'PLAN_ALREADY_EXISTS');
  }
  try {
    const result = await query(
      `
        INSERT INTO plans (id, name, price_amount, currency, monthly_limit, features, is_active)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        RETURNING ${PLAN_COLUMNS}
      `,
      [
        id,
        input.name.trim(),
        input.price_amount,
        (input.currency ?? 'XOF').trim().toUpperCase() || 'XOF',
        input.monthly_limit ?? null,
        JSON.stringify(input.features ?? []),
        input.is_active ?? true,
      ],
    );
    return toPlanRow(result.rows[0]);
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23514') {
      throw new HttpError('Invalid plan values (id slug, price or monthly limit).', 400);
    }
    throw err;
  }
};

export const updatePlan = async (id: string, input: PlanUpdateInput): Promise<PlanRow> => {
  const plan = await getPlanById(id);
  if (!plan) {
    throw new HttpError('Plan not found.', 404);
  }
  const result = await query(
    `
      UPDATE plans
      SET
        name = COALESCE($2, name),
        price_amount = COALESCE($3, price_amount),
        currency = COALESCE($4, currency),
        monthly_limit = $5,
        features = COALESCE($6::jsonb, features),
        is_active = COALESCE($7, is_active)
      WHERE id = $1
      RETURNING ${PLAN_COLUMNS}
    `,
    [
      plan.id,
      input.name?.trim() || null,
      input.price_amount ?? null,
      input.currency ? input.currency.trim().toUpperCase() || 'XOF' : null,
      input.monthly_limit === undefined ? plan.monthly_limit : input.monthly_limit,
      input.features ? JSON.stringify(input.features) : null,
      input.is_active ?? null,
    ],
  );
  return toPlanRow(result.rows[0]);
};

export const deletePlan = async (id: string): Promise<void> => {
  const plan = await getPlanById(id);
  if (!plan) {
    throw new HttpError('Plan not found.', 404);
  }
  if (plan.id === 'free') {
    throw new HttpError('The free plan cannot be deleted.', 400);
  }
  const inUse = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM users WHERE subscription_plan = $1`,
    [plan.id],
  );
  if (Number(inUse.rows[0]?.count ?? '0') > 0) {
    throw new HttpError(
      `Plan "${plan.id}" is assigned to users. Deactivate it instead of deleting.`,
      409,
      'PLAN_IN_USE',
    );
  }
  await query(`DELETE FROM plans WHERE id = $1`, [plan.id]);
};
