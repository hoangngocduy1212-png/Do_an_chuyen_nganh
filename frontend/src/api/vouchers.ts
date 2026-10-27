import type { Voucher } from '../types/voucher';
import { mockVouchers } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const vouchersApi = {
  available: async (): Promise<Voucher[]> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'error') throw new Error('mock-vouchers-error');
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'empty') return [];
      const now = Date.now();
      return mockVouchers.filter((voucher) => Date.parse(voucher.startDate) <= now && Date.parse(voucher.endDate) >= now);
    }
    return http.get<{ success: true; data: Voucher[] }>('/vouchers/available').then(unwrapApiResponse);
  },
};