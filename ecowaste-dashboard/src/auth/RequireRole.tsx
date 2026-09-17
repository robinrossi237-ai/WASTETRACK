import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import type { UserRole } from '@/api/authApi';
import { useAuth } from './AuthContext';

export const RequireRole = ({
  role,
  children
}: {
  role: Exclude<UserRole, 'resident'>;
  children: ReactNode;
}) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/unauthorized" replace />;

  return children;
};

