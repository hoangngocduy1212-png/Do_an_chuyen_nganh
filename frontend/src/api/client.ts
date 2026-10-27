import axios from 'axios';

export const TOKEN_KEY = 'accessToken';

// Mot axios dung chung: tu gan JWT, tu bong "data" ra khoi { success, data }
export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' });

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
  const e = err as any;
  return e?.response?.data?.error?.message ?? e?.message ?? 'Co loi xay ra';
}
