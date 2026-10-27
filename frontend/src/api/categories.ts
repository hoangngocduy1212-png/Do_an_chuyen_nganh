import type { Category } from '../types';
import { mockCategories } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const categoriesApi = {
  list: () => isMockEnabled
    ? Promise.resolve(import.meta.env.VITE_MOCK_CATEGORIES_MODE === 'empty' ? [] : mockCategories)
    : http.get<{ success: true; data: Category[] }>('/categories').then(unwrapApiResponse),
};