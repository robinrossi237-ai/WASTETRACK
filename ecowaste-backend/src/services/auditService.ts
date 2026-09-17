import { query } from '../config/db';

type AuditInput = {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export const writeAuditLog = async (input: AuditInput): Promise<void> => {
  await query(
    `
      INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [input.entityType, input.entityId, input.action, input.actorId ?? null, input.metadata ?? null]
  );
};

export type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const listAuditLogs = async (
  opts: { entityType?: string; entityId?: string; limit?: number } = {}
): Promise<AuditLogRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.entityType) {
    params.push(opts.entityType);
    where.push(`entity_type = $${params.length}`);
  }
  if (opts.entityId) {
    params.push(opts.entityId);
    where.push(`entity_id = $${params.length}`);
  }

  params.push(opts.limit ?? 200);

  const res = await query<AuditLogRow>(
    `
      SELECT
        a.id,
        a.entity_type,
        a.entity_id,
        a.action,
        a.actor_id,
        u.name AS actor_name,
        u.email AS actor_email,
        u.role AS actor_role,
        a.metadata,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}
    `,
    params
  );

  return res.rows;
};
