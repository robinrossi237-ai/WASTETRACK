import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { HttpError } from '../middlewares/errorHandler';
import { USER_ROLES, type UserRole } from '../models/user';

type AccessTokenClaims = {
  role: UserRole;
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const createAccessToken = (user: { id: string; role: UserRole }): string => {
  const payload: AccessTokenClaims = { role: user.role };
  const expiresIn = env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn'];

  return jwt.sign(payload, env.JWT_SECRET, {
    subject: user.id,
    expiresIn,
  });
};

export const getBearerToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const verifyAccessToken = (token: string): { userId: string; role: UserRole } => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload &
      Partial<AccessTokenClaims>;

    if (typeof decoded.sub !== 'string') {
      throw new HttpError('Unauthorized', 401);
    }

    if (typeof decoded.role !== 'string' || !USER_ROLES.includes(decoded.role as UserRole)) {
      throw new HttpError('Unauthorized', 401);
    }

    return { userId: decoded.sub, role: decoded.role as UserRole };
  } catch {
    throw new HttpError('Unauthorized', 401);
  }
};
