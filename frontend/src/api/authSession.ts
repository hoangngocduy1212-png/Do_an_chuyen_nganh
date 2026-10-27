import { http } from './client';

export const authSessionApi = {
	logout: () => import.meta.env.VITE_USE_MOCK === 'true' ? Promise.resolve({ data: { success: true } }) : http.post('/auth/logout'),
};