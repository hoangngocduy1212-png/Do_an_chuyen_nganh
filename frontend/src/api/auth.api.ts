import type { AuthUser } from '../types';
import { http } from './client';

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<{ data: LoginResult }>('/auth/login', { email, password }).then((r) => r.data.data),
  register: (body: { fullName: string; email: string; phone?: string; password: string }) =>
    http.post<{ data: LoginResult }>('/auth/register', body).then((r) => r.data.data),
};
