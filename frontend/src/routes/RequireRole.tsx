import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import type { Role } from '../types';

/** Chan trang theo vai tro: <RequireRole roles={['ADMIN']}>...</RequireRole> */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
