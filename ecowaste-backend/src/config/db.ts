import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import { env } from './env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL error', err);
});

export const initDb = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    client.release();
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL', err);
    throw err;
  }
};

export const query = async <R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> => {
  return pool.query<R>(text, params);
};

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const pingDb = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

export const closeDb = async (): Promise<void> => {
  await pool.end();
};
