import type { MembershipSummary } from '../types/user';
import type { PointTransactionsPage } from '../types/membership';
import { mockMembership, mockPointHistory } from './mock/account';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const membershipsApi = {
  me: () => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'membership') return Promise.reject(new Error('Không tải được thành viên'));
      if (import.meta.env.VITE_MOCK_MEMBERSHIP_LEVEL === 'highest') return Promise.resolve({ ...mockMembership, pointBalance: 3200, lifetimePoints: 3200, memberLevel: 'Kim cương' });
      if (import.meta.env.VITE_MOCK_MEMBERSHIP_LEVEL === 'regular') return Promise.resolve({ ...mockMembership, pointBalance: 0, lifetimePoints: 0, memberLevel: 'Thường' });
      return Promise.resolve(mockMembership);
    }
    return http.get<{ success: true; data: MembershipSummary }>('/memberships/me').then(unwrapApiResponse);
  },
  transactions: async (page = 1, limit = 10): Promise<PointTransactionsPage> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_POINTS_EMPTY === 'true') return { items: [], page, limit, total: 0 };
      if (import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'points') throw new Error('Không tải được lịch sử điểm');
      const start = (page - 1) * limit;
      return { items: mockPointHistory.slice(start, start + limit), page, limit, total: mockPointHistory.length };
    }
    return http.get<{ success: true; data: PointTransactionsPage }>('/memberships/me/transactions', { params: { page, limit } }).then(unwrapApiResponse);
  },
};