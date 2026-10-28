import type { Voucher } from '../types/voucher';
import { mockVouchers } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import { MockApiError, mockScenario } from './mock/scenarios';

export const vouchersApi = {
  validate: async (code: string, orderAmount: number): Promise<{ discountAmount: number }> => {
    if (isMockEnabled) {
      if (mockScenario.voucherMode === 'network-error') throw new MockApiError('Không thể kết nối để kiểm tra voucher.', 'NETWORK');
      if (mockScenario.voucherMode === 'invalid') throw new MockApiError('Mã voucher không hợp lệ.', 'VOUCHER_INVALID');
      if (mockScenario.voucherMode === 'expired') throw new MockApiError('Mã voucher đã hết hạn.', 'VOUCHER_EXPIRED');
      if (mockScenario.voucherMode === 'used') throw new MockApiError('Mã voucher đã được sử dụng.', 'VOUCHER_ALREADY_USED');
      if (mockScenario.voucherMode === 'minimum') throw new MockApiError('Đơn hàng chưa đạt giá trị tối thiểu của voucher.', 'VOUCHER_MINIMUM_NOT_MET');
      const voucher = mockVouchers.find((item) => item.code.toLocaleUpperCase('vi') === code.trim().toLocaleUpperCase('vi'));
      if (!voucher) throw new MockApiError('Mã voucher không tồn tại.', 'VOUCHER_INVALID');
      if (Date.parse(voucher.endDate) < Date.now()) throw new MockApiError('Mã voucher đã hết hạn.', 'VOUCHER_EXPIRED');
      if (orderAmount < voucher.minimumOrder) throw new MockApiError(`Đơn hàng chưa đạt tối thiểu ${voucher.minimumOrder.toLocaleString('vi-VN')}đ.`, 'VOUCHER_MINIMUM_NOT_MET');
      return { discountAmount: voucher.discountValue };
    }
    return http.post<{ success: true; data: { discountAmount: number } }>('/vouchers/validate', { code, orderAmount }).then(unwrapApiResponse);
  },
  available: async (): Promise<Voucher[]> => {
    if (isMockEnabled) {
      if (mockScenario.voucherMode === 'network-error') throw new MockApiError('Không thể tải voucher.', 'NETWORK');
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'error') throw new Error('mock-vouchers-error');
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'empty') return [];
      const now = Date.now();
      return mockVouchers.filter((voucher) => Date.parse(voucher.startDate) <= now && Date.parse(voucher.endDate) >= now);
    }
    return http.get<{ success: true; data: Voucher[] }>('/vouchers/available').then(unwrapApiResponse);
  },
};