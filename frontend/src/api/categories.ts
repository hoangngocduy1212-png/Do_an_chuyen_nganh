import type { Category } from '../types';
import { mockCategories } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const categoriesApi = {
  list: () => isMockEnabled
    ? Promise.resolve(import.meta.env.VITE_MOCK_CATEGORIES_MODE === 'empty' ? [] : mockCategories)
    : http.get<{ success: true; data: Category[] }>('/categories').then(unwrapApiResponse),
  create: async (body: { categoryName: string; description?: string }): Promise<Category> => {
    if (isMockEnabled) {
      const category: Category = { _id: `mock-category-${Date.now()}`, ...body };
      mockCategories.push(category);
      return category;
    }
    return http.post<{ success: true; data: Category }>('/categories', body).then(unwrapApiResponse);
  },
  update: async (id: string, body: { categoryName?: string; description?: string }): Promise<Category> => {
    if (isMockEnabled) {
      const category = mockCategories.find((item) => item._id === id);
      if (!category) throw new Error('Không tìm thấy danh mục');
      Object.assign(category, body);
      return category;
    }
    return http.patch<{ success: true; data: Category }>(`/categories/${id}`, body).then(unwrapApiResponse);
  },
  remove: async (id: string): Promise<void> => {
    if (isMockEnabled) {
      const index = mockCategories.findIndex((item) => item._id === id);
      if (index < 0) throw new Error('Không tìm thấy danh mục');
      mockCategories.splice(index, 1);
      return;
    }
    await http.delete<{ success: true; data: { deleted: boolean } }>(`/categories/${id}`);
  },
};