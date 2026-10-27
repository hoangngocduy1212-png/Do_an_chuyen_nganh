import type { Category } from '../types';
import { http } from './client';

// Moi module backend co 1 file *.api.ts tuong ung o day
export const categoriesApi = {
  list: () => http.get<{ data: Category[] }>('/categories').then((r) => r.data.data),
};
