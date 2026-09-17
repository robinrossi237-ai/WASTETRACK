import jwt from 'jsonwebtoken';

import {
  createAccessToken,
  getBearerToken,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from './authService';

describe('getBearerToken', () => {
  it('extracts a bearer token', () => {
    expect(getBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('accepts a lowercase scheme', () => {
    expect(getBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null for a missing header', () => {
    expect(getBearerToken(undefined)).toBeNull();
  });

  it('returns null for a non-bearer scheme', () => {
    expect(getBearerToken('Basic abc')).toBeNull();
  });

  it('returns null for a scheme without a token', () => {
    expect(getBearerToken('Bearer')).toBeNull();
  });
});

describe('createAccessToken / verifyAccessToken', () => {
  it('round-trips a valid token', () => {
    const token = createAccessToken({ id: 'user-123', role: 'collector' });
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe('user-123');
    expect(decoded.role).toBe('collector');
  });

  it('rejects a token with an invalid subject', () => {
    const token = jwt.sign({ role: 'resident' }, process.env.JWT_SECRET as string, {
      expiresIn: '1h',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a token with an unknown role', () => {
    const token = jwt.sign({ role: 'superadmin' }, process.env.JWT_SECRET as string, {
      expiresIn: '1h',
      subject: 'user-1',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ role: 'resident' }, process.env.JWT_SECRET as string, {
      expiresIn: '-1h',
      subject: 'user-1',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ role: 'resident' }, 'different-secret', {
      expiresIn: '1h',
      subject: 'user-1',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a token with a malformed payload', () => {
    const token = jwt.sign({ role: 42 }, process.env.JWT_SECRET as string, {
      expiresIn: '1h',
      subject: 'user-1',
    });

    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects garbage input', () => {
    expect(() => verifyAccessToken('not-a-token')).toThrow();
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toBe('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('produces distinct hashes for the same password', async () => {
    const password = 'same-password';
    const hashA = await hashPassword(password);
    const hashB = await hashPassword(password);

    expect(hashA).not.toBe(hashB);
  });
});
