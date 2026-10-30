import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ApiSuccess } from '../types';

export const TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

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
  async (err) => {
    const config = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (err.response?.status !== 401 || !config) return Promise.reject(err);
    const isAuthCall = /\/auth\/(login|register|refresh)/.test(config.url ?? '');
    if (!isAuthCall && !config._retried && localStorage.getItem(REFRESH_TOKEN_KEY)) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return http(config);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    return Promise.reject(err);
  },
);

let refreshing: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  refreshing ??= axios
    .post<{ data: { accessToken: string; refreshToken: string } }>(`${http.defaults.baseURL}/auth/refresh`, { refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) })
    .then(({ data }) => {
      localStorage.setItem(TOKEN_KEY, data.data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
      return data.data.accessToken;
    })
    .catch(() => {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

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
