import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

const databaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
      } catch {
        return false;
      }
    },
    {
      message:
        'DATABASE_URL must be a valid PostgreSQL connection string (e.g. postgresql://user:password@localhost:5432/ecowaste_db)',
    }
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: databaseUrlSchema,
  DATABASE_SSL: z.enum(['true', 'false']).optional(),
  JWT_SECRET: z.string().trim().min(1),
  JWT_EXPIRES_IN: z.string().trim().min(1).default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTHENTICATED_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  SIGNUP_SECRET: z.string().trim().min(1).optional(),
  CORS_ORIGIN: z.string().trim().optional(),
  EXPO_PUSH_ENDPOINT: z.string().trim().url().default('https://exp.host/--/api/v2/push/send'),
  EXPO_PUSH_ACCESS_TOKEN: z.string().trim().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (raw: NodeJS.ProcessEnv): Env => envSchema.parse(raw);

export const env: Env = parseEnv(process.env);
