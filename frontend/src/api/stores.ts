import type { StoreLocation } from '../types/store';
import { mockStores } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const storesApi = {
  list: async () => {
    const stores = isMockEnabled
      ? mockStores
      : await http.get<{ success: true; data: StoreLocation[] }>('/stores').then(unwrapApiResponse);
    return stores.filter((store) => store.status === 'ACTIVE');
  },
};