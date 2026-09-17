import { query } from '../config/db';

export type LeaderboardRow = {
  user_id: string;
  name: string;
  neighborhood: string | null;
  points: number;
};

const PLUS_CODE_PART_PATTERN = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i;
const PLUS_CODE_PREFIX_PATTERN = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}\s*/i;

const normalizeAreaText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const extractAreaParts = (value?: string | null): string[] => {
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];

  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return [];

  const cleaned = [...parts];
  if (PLUS_CODE_PART_PATTERN.test(cleaned[0])) {
    cleaned.shift();
  } else {
    cleaned[0] = cleaned[0].replace(PLUS_CODE_PREFIX_PATTERN, '').trim();
  }

  const uniqueOrdered: string[] = [];
  const seen = new Set<string>();
  for (const part of cleaned) {
    const normalized = part.trim();
    if (!normalized) continue;
    const key = normalizeAreaText(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrdered.push(normalized);
  }

  return uniqueOrdered;
};

const summarizeArea = (value?: string | null): string | null => {
  const uniqueOrdered = extractAreaParts(value);

  if (uniqueOrdered.length === 0) return null;
  if (uniqueOrdered.length >= 2) {
    const lastTwo = uniqueOrdered.slice(-2);
    if (normalizeAreaText(lastTwo[0]) === normalizeAreaText(lastTwo[1])) {
      return lastTwo[0];
    }
    return `${lastTwo[0]}, ${lastTwo[1]}`;
  }

  return uniqueOrdered[0];
};

const areaMatchesSector = (rowArea: string | null, sectorArea: string): boolean => {
  const sectorParts = extractAreaParts(sectorArea).map(normalizeAreaText);
  if (sectorParts.length === 0) return true;

  const rowParts = extractAreaParts(rowArea).map(normalizeAreaText);
  if (rowParts.length === 0) return false;

  return sectorParts.every((sectorPart) =>
    rowParts.some((rowPart) => rowPart.includes(sectorPart))
  );
};

export const listLeaderboard = async (input: {
  limit: number;
  area?: string;
}): Promise<LeaderboardRow[]> => {
  const normalizedArea = summarizeArea(input.area) ?? null;
  const params: unknown[] = [];
  const where: string[] = ["u.role = 'resident'", 'u.is_active = true'];
  let sql = `
    SELECT
      u.id AS user_id,
      u.name,
      u.area AS neighborhood,
      COALESCE(SUM(r.points), 0)::int AS points
    FROM users u
    LEFT JOIN rewards r ON r.user_id = u.id
    WHERE ${where.join(' AND ')}
    GROUP BY u.id
    ORDER BY points DESC, u.created_at ASC
  `;

  if (!normalizedArea) {
    params.push(input.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const res = await query<LeaderboardRow>(sql, params);

  const filteredRows = normalizedArea
    ? res.rows.filter((row) => areaMatchesSector(row.neighborhood, normalizedArea))
    : res.rows;

  const normalizedRows = filteredRows.map((row) => ({
    ...row,
    neighborhood: summarizeArea(row.neighborhood),
  }));

  return normalizedRows.slice(0, input.limit);
};
