import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { authApi, type AuthUser, type UserRole } from '@/api/authApi';
import { getStoredToken, setStoredToken } from '@/api/axios';

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isInitializing: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<AuthUser | null>;
  hasRole: (...roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  const refreshMe = async (): Promise<AuthUser | null> => {
    if (!getStoredToken()) return null;
    try {
      const res = await authApi.me();
      if (res.user.role !== 'admin') {
        logout();
        return null;
      }
      setUser(res.user);
      return res.user;
    } catch {
      logout();
      return null;
    }
  };

  useEffect(() => {
    const run = async () => {
      const stored = getStoredToken();
      setToken(stored);
      if (!stored) {
        setIsInitializing(false);
        return;
      }
      await refreshMe();
      setIsInitializing(false);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
      toast.error('Session expired. Please sign in again.');
    };
    window.addEventListener('ecowaste:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ecowaste:unauthorized', onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (input: { email: string; password: string }): Promise<AuthUser> => {
    const data = await authApi.login(input);
    setStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const value: AuthContextValue = useMemo(
    () => ({
      token,
      user,
      isInitializing,
      login,
      logout,
      refreshMe,
      hasRole: (...roles) => !!user && roles.includes(user.role)
    }),
    [token, user, isInitializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
