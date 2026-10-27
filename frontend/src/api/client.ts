import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { ApiSuccess } from '../types';

export const TOKEN_KEY = 'accessToken';

// Mot axios dung chung: tu gan JWT, tu bong "data" ra khoi { success, data }
export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' });

export const isMockEnabled = import.meta.env.VITE_USE_MOCK === 'true';

export function unwrapApiResponse<T>(response: AxiosResponse<ApiSuccess<T>>): T {
  return response.data.data;
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) localStorage.removeItem(TOKEN_KEY);
    return Promise.reject(err);
  },
);

/** Lay thong bao loi than thien tu response cua backend. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(err)) {
    return err.response?.data.error?.message ?? err.message ?? 'Có lỗi xảy ra';
  }
  return err instanceof Error ? err.message : 'Có lỗi xảy ra';
}

interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}
