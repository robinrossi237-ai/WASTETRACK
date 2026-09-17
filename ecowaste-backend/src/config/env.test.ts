import { envSchema, parseEnv } from './env';

const validEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/ecowaste_db',
  JWT_SECRET: 'secret',
};

describe('parseEnv', () => {
  it('applies defaults for optional fields', () => {
    const parsed = parseEnv(validEnv);

    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(5000);
    expect(parsed.JWT_EXPIRES_IN).toBe('7d');
    expect(parsed.BCRYPT_SALT_ROUNDS).toBe(12);
    expect(parsed.RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(parsed.RATE_LIMIT_MAX).toBe(100);
    expect(parsed.EXPO_PUSH_ENDPOINT).toBe('https://exp.host/--/api/v2/push/send');
  });

  it('coerces numeric env vars', () => {
    const parsed = parseEnv({ ...validEnv, PORT: '8080', BCRYPT_SALT_ROUNDS: '10' });

    expect(parsed.PORT).toBe(8080);
    expect(parsed.BCRYPT_SALT_ROUNDS).toBe(10);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: 'mysql://user:pass@localhost/db' })
    ).toThrow();
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => parseEnv({ ...validEnv, JWT_SECRET: '' })).toThrow();
  });

  it('rejects an out-of-range BCRYPT_SALT_ROUNDS', () => {
    expect(() => parseEnv({ ...validEnv, BCRYPT_SALT_ROUNDS: '3' })).toThrow();
    expect(() => parseEnv({ ...validEnv, BCRYPT_SALT_ROUNDS: '16' })).toThrow();
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
  });

  it('normalizes without mutating the input object', () => {
    const input = { ...validEnv };
    parseEnv(input);

    expect(input.NODE_ENV).toBe('test');
  });
});

describe('envSchema shape', () => {
  it('exposes the full Env type shape', () => {
    // Guards against accidental removal/silent-rename of expected keys.
    const shape = envSchema.shape as Record<string, unknown>;
    for (const key of [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_EXPIRES_IN',
      'BCRYPT_SALT_ROUNDS',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_AUTHENTICATED_MAX',
      'AUTH_RATE_LIMIT_MAX',
      'SIGNUP_SECRET',
      'CORS_ORIGIN',
      'EXPO_PUSH_ENDPOINT',
      'EXPO_PUSH_ACCESS_TOKEN',
    ]) {
      expect(shape[key]).toBeDefined();
    }
  });
});
