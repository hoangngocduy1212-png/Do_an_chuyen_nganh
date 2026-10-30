import type { Voucher } from '../types/voucher';
import { mockVouchers } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import { MockApiError, mockScenario } from './mock/scenarios';

export interface AdminVoucherRecord {
  voucherId: string;
  code: string;
  description: string;
  discountValue: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  usageLimit?: number;
  usedCount: number;
}

export interface AdminVoucherInput {
  code: string;
  description: string;
  discountValue: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  usageLimit?: number;
}

interface VoucherApiRecord extends Partial<AdminVoucherRecord> {
  _id?: string;
  minimumOrder?: number;
}

const mockAdminVouchers: AdminVoucherRecord[] = mockVouchers.map((voucher) => ({
  voucherId: voucher.voucherId,
  code: voucher.code,
  description: 'Ưu đãi mua sắm Muadee',
  discountValue: voucher.discountValue,
  minOrderAmount: voucher.minimumOrder,
  startDate: voucher.startDate,
  endDate: voucher.endDate,
  status: 'ACTIVE',
  usedCount: 0,
}));

function toAdminVoucher(voucher: VoucherApiRecord): AdminVoucherRecord {
  return {
    voucherId: voucher.voucherId ?? voucher._id ?? '',
    code: voucher.code ?? '',
    description: voucher.description ?? '',
    discountValue: voucher.discountValue ?? 0,
    minOrderAmount: voucher.minOrderAmount ?? voucher.minimumOrder ?? 0,
    startDate: voucher.startDate ?? '',
    endDate: voucher.endDate ?? '',
    status: voucher.status ?? 'ACTIVE',
    ...(voucher.usageLimit === undefined ? {} : { usageLimit: voucher.usageLimit }),
    usedCount: voucher.usedCount ?? 0,
  };
}

function syncMockVoucher(voucher: AdminVoucherRecord): void {
  const existing = mockVouchers.find((item) => item.voucherId === voucher.voucherId);
  if (existing) {
    existing.code = voucher.code;
    existing.discountValue = voucher.discountValue;
    existing.minimumOrder = voucher.minOrderAmount;
    existing.startDate = voucher.startDate;
    existing.endDate = voucher.endDate;
  } else {
    mockVouchers.push({
      voucherId: voucher.voucherId,
      code: voucher.code,
      discountValue: voucher.discountValue,
      minimumOrder: voucher.minOrderAmount,
      startDate: voucher.startDate,
      endDate: voucher.endDate,
    });
  }
}

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
      if (mockAdminVouchers.find((item) => item.voucherId === voucher.voucherId)?.status === 'INACTIVE') throw new MockApiError('Mã voucher không hợp lệ.', 'VOUCHER_INVALID');
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
      return mockVouchers.filter((voucher) => Date.parse(voucher.startDate) <= now && Date.parse(voucher.endDate) >= now
        && mockAdminVouchers.find((item) => item.voucherId === voucher.voucherId)?.status !== 'INACTIVE');
    }
    const records = await http.get<{ success: true; data: Array<Partial<Voucher> & { minOrderAmount?: number; _id?: string }> }>('/vouchers/available').then(unwrapApiResponse);
    return records.map((record) => ({
      voucherId: record.voucherId ?? record._id ?? '',
      code: record.code ?? '',
      discountValue: record.discountValue ?? 0,
      discountType: record.discountType,
      minimumOrder: record.minimumOrder ?? record.minOrderAmount ?? 0,
      startDate: record.startDate ?? '',
      endDate: record.endDate ?? '',
    }));
  },
  adminList: async (): Promise<AdminVoucherRecord[]> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'error') throw new Error('Không tải được voucher mock');
      if (import.meta.env.VITE_MOCK_VOUCHERS_MODE === 'empty') return [];
      return mockAdminVouchers.map((voucher) => ({ ...voucher }));
    }
    const response = await http.get<{ success: true; data: VoucherApiRecord[] }>('/vouchers');
    return unwrapApiResponse(response).map(toAdminVoucher);
  },
  adminCreate: async (input: AdminVoucherInput): Promise<AdminVoucherRecord> => {
    if (isMockEnabled) {
      const voucher: AdminVoucherRecord = { ...input, voucherId: `mock-voucher-${Date.now()}`, usedCount: 0 };
      mockAdminVouchers.unshift(voucher);
      syncMockVoucher(voucher);
      return { ...voucher };
    }
    const response = await http.post<{ success: true; data: VoucherApiRecord }>('/vouchers', input);
    return toAdminVoucher(unwrapApiResponse(response));
  },
  adminUpdate: async (id: string, input: AdminVoucherInput): Promise<AdminVoucherRecord> => {
    if (isMockEnabled) {
      const index = mockAdminVouchers.findIndex((voucher) => voucher.voucherId === id);
      if (index < 0) throw new Error('Không tìm thấy voucher');
      const updated: AdminVoucherRecord = { ...mockAdminVouchers[index], ...input };
      mockAdminVouchers[index] = updated;
      syncMockVoucher(updated);
      return { ...updated };
    }
    const response = await http.patch<{ success: true; data: VoucherApiRecord }>(`/vouchers/${id}`, input);
    return toAdminVoucher(unwrapApiResponse(response));
  },
  adminRemove: async (id: string): Promise<void> => {
    if (isMockEnabled) {
      const index = mockAdminVouchers.findIndex((voucher) => voucher.voucherId === id);
      if (index < 0) throw new Error('Không tìm thấy voucher');
      mockAdminVouchers.splice(index, 1);
      const mockIndex = mockVouchers.findIndex((voucher) => voucher.voucherId === id);
      if (mockIndex >= 0) mockVouchers.splice(mockIndex, 1);
      return;
    }
    await http.delete<{ success: true; data: { deleted: boolean } }>(`/vouchers/${id}`);
  },
};