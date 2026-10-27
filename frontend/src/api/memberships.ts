import type { MembershipSummary } from '../types/user';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const membershipsApi = {
  me: () => isMockEnabled
    ? Promise.resolve({ pointBalance: 1250, memberLevel: 'Bạc' })
    : http.get<{ success: true; data: MembershipSummary }>('/memberships/me').then(unwrapApiResponse),
};