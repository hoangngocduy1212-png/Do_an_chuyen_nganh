import { createContext, useContext, useState, type ReactNode } from 'react';
import { TOKEN_KEY } from '../api/client';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthState | null>(null);
const USER_KEY = 'authUser';

function readUser(): AuthUser | null {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    if (import.meta.env.VITE_MOCK_USER === 'customer') {
      return { userId: 'mock-customer-01', fullName: 'Nguyễn Minh Anh', email: 'khachhang@muadee.vn', role: 'CUSTOMER' };
    }
    if (import.meta.env.VITE_MOCK_USER === 'guest') return null;
  }
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);

  const signIn = (token: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };
  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return <AuthContext.Provider value={{ user, signIn, signOut, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phai nam trong <AuthProvider>');
  return ctx;
}
