import { query } from '../config/db';

type NeighborhoodRow = { name: string };

export const searchNeighborhoods = async (q: string): Promise<string[]> => {
  const params: unknown[] = [];
  let where = '';
  if (q.trim()) {
    params.push(`%${q.trim().toLowerCase()}%`);
    where = 'WHERE name LIKE $1';
  }

  const res = await query<NeighborhoodRow>(
    `
      SELECT name
      FROM mv_neighborhoods
      ${where}
      ORDER BY name ASC
      LIMIT 50
    `,
    params
  );

  return res.rows
    .map((r) => r.name)
    .filter((name) => !!name)
    .map((name) => name.replace(/\s+/g, ' ').trim());
};
