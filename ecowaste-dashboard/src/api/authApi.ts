import { api } from './axios';

export type UserRole = 'resident' | 'collector' | 'admin';

export type AuthUser = {
  id: string;
  role: UserRole;
  name?: string;
  email?: string;
};

export type LoginResponse = {
  success: true;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

export type MeResponse = {
  success: true;
  user: AuthUser;
};

export const authApi = {
  login: async (input: { email: string; password: string }): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>('/auth/login', input);
    return res.data;
  },
  me: async (): Promise<MeResponse> => {
    const res = await api.get<MeResponse>('/auth/me');
    return res.data;
  }
};

