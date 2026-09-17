import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

import { env } from '../config/env';

type MigrationRow = {
  filename: string;
};

const getProjectRoot = (): string => {
  // Works for both `src/utils` (ts-node) and `dist/utils` (compiled).
  // - src/utils -> projectRoot (.., ..)
  // - dist/utils -> projectRoot (.., ..)
  return path.resolve(__dirname, '..', '..');
};

const resolveMigrationsDir = async (): Promise<string> => {
  const projectRoot = getProjectRoot();
  const candidates = [
    process.env.MIGRATIONS_DIR,
    path.join(projectRoot, 'dist', 'migrations'),
    path.join(projectRoot, 'src', 'migrations'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(
    `Migrations directory not found. Tried: ${candidates.join(', ')}. Set MIGRATIONS_DIR to override.`
  );
};

const ensureSchemaMigrationsTable = async (pool: Pool): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      executed_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

const getExecutedMigrations = async (pool: Pool): Promise<Set<string>> => {
  const result = await pool.query<MigrationRow>('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r: MigrationRow) => r.filename));
};

const readMigrationFiles = async (migrationsDir: string): Promise<string[]> => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
};

const applyMigration = async (
  pool: Pool,
  migrationsDir: string,
  filename: string
): Promise<void> => {
  const fullPath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(fullPath, 'utf8');

  if (sql.trim().length === 0) {
    throw new Error(`Migration file is empty: ${filename}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const run = async (): Promise<void> => {
  const migrationsDir = await resolveMigrationsDir();
  console.log(`Using migrations directory: ${migrationsDir}`);

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await ensureSchemaMigrationsTable(pool);

    const executed = await getExecutedMigrations(pool);
    const files = await readMigrationFiles(migrationsDir);

    for (const file of files) {
      if (executed.has(file)) {
        continue;
      }

      console.log(`Applying migration: ${file}`);
      await applyMigration(pool, migrationsDir, file);
    }

    console.log('Migrations complete');
  } finally {
    await pool.end();
  }
};

void run().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
