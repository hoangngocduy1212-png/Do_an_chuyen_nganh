import type { StoreLocation } from '../types/store';
import { mockStores } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import { mockScenario } from './mock/scenarios';

export const storesApi = {
  list: async () => {
    const stores = isMockEnabled
      ? mockStores
      : await http.get<{ success: true; data: StoreLocation[] }>('/stores').then(unwrapApiResponse);
    return stores.filter((store) => store.status === 'ACTIVE');
  },
  checkDelivery: async (storeId: string, address: string): Promise<{ serviceable: boolean; estimatedFee: number }> => {
    if (isMockEnabled) {
      const lower = address.toLocaleLowerCase('vi');
      const serviceable = mockScenario.deliveryAddressMode === 'outside'
        ? false
        : mockScenario.deliveryAddressMode === 'inside'
          ? true
          : !lower.includes('long an') && !lower.includes('bình dương') && !lower.includes('ngoài vùng');
      return { serviceable, estimatedFee: serviceable ? 20000 : 0 };
    }
    try { return await http.post<{ success: true; data: { serviceable: boolean; estimatedFee: number } }>(`/stores/${storeId}/serviceability`, { address }).then(unwrapApiResponse); }
    catch { return { serviceable: true, estimatedFee: 20000 }; }
  },
};