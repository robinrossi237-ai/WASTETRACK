/**
 * Runs once per test worker before any test module is imported.
 * `config/env.ts` parses `process.env` at import time, so the variables below
 * must exist before anything is evaluated. This keeps unit tests hermetic,
 * independent of any local `.env` file, and CI-friendly.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ecowaste_test';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';