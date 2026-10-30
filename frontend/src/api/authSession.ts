import { http, REFRESH_TOKEN_KEY } from './client';

export const authSessionApi = {
	logout: () => import.meta.env.VITE_USE_MOCK === 'true' ? Promise.resolve({ data: { success: true } }) : http.post('/auth/logout', { refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined }),
};