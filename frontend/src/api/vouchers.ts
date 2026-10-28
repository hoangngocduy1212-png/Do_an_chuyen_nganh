import type { Voucher } from '../types/voucher';
import { mockVouchers } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const vouchersApi = {
  validate: async (code: string, orderAmount: number): Promise<{ discountAmount: number }> => {
    if (isMockEnabled) {
      const voucher = mockVouchers.find((item) => item.code.toLocaleUpperCase('vi') === code.trim().toLocaleUpperCase('vi'));
      if (!voucher) throw new Error('Mã không tồn tại');
      if (Date.parse(voucher.endDate) < Date.now()) throw new Error('Mã đã hết hạn');
      if (orderAmount < voucher.minimumOrder) throw new Error(`Đơn hàng chưa đạt tối thiểu ${voucher.minimumOrder.toLocaleString('vi-VN')}đ`);
      return { discountAmount: voucher.discountValue };
    }
    return http.post<{ success: true; data: { discountAmount: number } }>('/vouchers/validate', { code, orderAmount }).then(unwrapApiResponse);
  },
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