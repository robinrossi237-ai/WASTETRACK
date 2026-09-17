import type { NextFunction, Request, Response } from 'express';

import { requireAuth, requireRole } from './auth';
import { HttpError } from './errorHandler';
import { createAccessToken } from '../services/authService';
import { findUserById } from '../services/userService';

jest.mock('../services/userService', () => ({
  findUserById: jest.fn(),
}));

const mockedFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;

const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  phone: '12345678',
  area: 'Douala',
  role: 'resident',
  is_active: true,
  collector_verification_status: null,
  collector_verification_note: null,
  collector_submitted_at: null,
  collector_verified_at: null,
  collector_auto_location_tracking: null,
  collector_exit_location_capture_enabled: null,
  ...overrides,
});

type MockRequest = {
  header: (name: string) => string | undefined;
  headers: Record<string, string | undefined>;
  user?: unknown;
};

type MockContext = {
  req: MockRequest;
  res: Partial<Response>;
  next: NextFunction;
};

const makeContext = (authorization?: string): MockContext => ({
  req: {
    headers: { authorization },
    header: (name) => (name === 'authorization' ? authorization : undefined),
  },
  res: {},
  next: jest.fn(),
});

const resolveNextError = (next: NextFunction): Promise<unknown> =>
  new Promise((resolve) => {
    const wrapped: NextFunction = (err?: unknown) => resolve(err);
    (next as jest.Mock).mockImplementation(wrapped);
  });

describe('requireRole', () => {
  afterEach(() => jest.clearAllMocks());

  it('passes through for an authorized role', () => {
    const { req, res, next } = makeContext();
    req.user = { id: 'user-1', role: 'collector' } as never;

    requireRole('collector')(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when the user is missing', () => {
    const { req, res, next } = makeContext();
    req.user = undefined;

    requireRole('collector')(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as jest.Mock).mock.calls[0][0] as HttpError;
    expect(err.statusCode).toBe(401);
  });

  it('forbids a user with the wrong role', () => {
    const { req, res, next } = makeContext();
    req.user = { id: 'user-1', role: 'resident' } as never;

    requireRole('collector')(req as unknown as Request, res as unknown as Response, next);

    const err = (next as jest.Mock).mock.calls[0][0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.statusCode).toBe(403);
  });

  it('supports multiple permitted roles', () => {
    const { req, res, next } = makeContext();
    req.user = { id: 'user-1', role: 'admin' } as never;

    requireRole('collector', 'admin')(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAuth', () => {
  afterEach(() => jest.clearAllMocks());

  it('rejects a request with no token', () => {
    const { req, res, next } = makeContext();

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.statusCode).toBe(401);
  });

  it('rejects a request with a garbage token', async () => {
    const { req, res, next } = makeContext('Bearer not-a-token');
    const errPromise = resolveNextError(next);

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    const err = await errPromise;
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).statusCode).toBe(401);
  });

  it('attaches the user for a valid token', async () => {
    const token = createAccessToken({ id: 'user-1', role: 'collector' });
    mockedFindUserById.mockResolvedValue(makeUser({ id: 'user-1', role: 'collector' }) as never);

    const { req, res, next } = makeContext(`Bearer ${token}`);
    const errPromise = resolveNextError(next);

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    const err = await errPromise;
    expect(err).toBeUndefined();
    expect(req.user).toMatchObject({ id: 'user-1', role: 'collector' });
  });

  it('rejects when the user does not exist', async () => {
    const token = createAccessToken({ id: 'ghost', role: 'resident' });
    mockedFindUserById.mockResolvedValue(null as never);

    const { req, res, next } = makeContext(`Bearer ${token}`);
    const errPromise = resolveNextError(next);

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    const err = await errPromise;
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).statusCode).toBe(401);
    expect(req.user).toBeUndefined();
  });

  it('forbids a disabled account', async () => {
    const token = createAccessToken({ id: 'user-disabled', role: 'resident' });
    mockedFindUserById.mockResolvedValue(
      makeUser({ id: 'user-disabled', role: 'resident', is_active: false }) as never
    );

    const { req, res, next } = makeContext(`Bearer ${token}`);
    const errPromise = resolveNextError(next);

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    const err = await errPromise;
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).statusCode).toBe(403);
    expect((err as HttpError).message).toMatch(/disabled/i);
  });

  it('forwards database errors to the error handler', async () => {
    const token = createAccessToken({ id: 'user-1', role: 'resident' });
    mockedFindUserById.mockRejectedValue(new Error('db down'));

    const { req, res, next } = makeContext(`Bearer ${token}`);
    const errPromise = resolveNextError(next);

    requireAuth(req as unknown as Request, res as unknown as Response, next);

    const err = await errPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('db down');
  });
});
