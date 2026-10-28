import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import type { Role } from '../types';

/** Chan trang theo vai tro: <RequireRole roles={['ADMIN']}>...</RequireRole> */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactElement }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  if (!roles.includes(user.role)) {
    const destination = user.role === 'ADMIN' ? '/admin/dashboard' : user.role === 'STAFF' ? '/staff/orders' : '/';
    return <Navigate to={destination} replace />;
  }
  return children;
}
