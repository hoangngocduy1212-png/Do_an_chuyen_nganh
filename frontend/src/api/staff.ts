import type { OrderStatus } from '../types/order';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import type { AdminOrderRecord } from './orders';
import type { InventoryRecord } from './inventory';
import { mockStaffApi } from './mock/staff';
import type { AdminVoucherInput, AdminVoucherRecord } from './vouchers';

export interface StaffProfile {
  user: { userId?: string; fullName: string; email: string; phoneNumber?: string; avatarUrl?: string };
  employee: { employeeId: string; employeeCode: string; employeeRole: string; storeId: string };
  store?: { storeId: string; storeName: string; address?: string; phone?: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type IssueType = 'OUT_OF_STOCK' | 'INVALID_INFORMATION' | 'OTHER';

export interface OrderIssue {
  issueId: string;
  orderId: string;
  type: IssueType;
  detail: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string;
}

export interface StaffReview {
  reviewId: string;
  orderId: string;
  productId: string;
  customerId: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
}

export interface SupportSession {
  sessionId: string;
  status: 'HANDED_OVER' | 'CLOSED' | 'AI_CHATTING';
  employeeId?: string;
  customerId?: string;
  handoverRequestedAt?: string;
  lastMessageAt?: string;
}

export interface SupportMessage {
  messageId?: string;
  _id?: string;
  senderType: string;
  content: string;
  createdAt?: string;
}

interface Envelope<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
}

async function page<T>(url: string, params: Record<string, unknown>): Promise<Paged<T>> {
  const response = await http.get<Envelope<T[]>>(url, { params });
  const { page: current = 1, limit = 20, total } = response.data.meta ?? {};
  return { items: response.data.data, total: total ?? response.data.data.length, page: current, limit };
}

const base = '/employees/me';

const realStaffApi = {
  profile: () => http.get<Envelope<StaffProfile>>(base).then(unwrapApiResponse),
  updateProfile: (input: { fullName?: string; phoneNumber?: string; avatarUrl?: string }) => http.patch(base, input).then(() => undefined),

  orders: (params: { orderStatus?: OrderStatus; page: number; limit: number }) => page<AdminOrderRecord>(`${base}/orders`, params),
  order: (id: string) => http.get<Envelope<AdminOrderRecord>>(`${base}/orders/${id}`).then(unwrapApiResponse),
  acceptOrder: (id: string) => http.post(`${base}/orders/${id}/accept`).then(() => undefined),
  cancelOrder: (id: string, reason: string) => http.post(`${base}/orders/${id}/cancel`, { reason }).then(() => undefined),
  updateStatus: (id: string, orderStatus: string) => http.patch(`${base}/orders/${id}/status`, { orderStatus }).then(() => undefined),
  updateWeight: (id: string, itemId: string, actualWeight: number) =>
    http.patch(`${base}/orders/${id}/items/${itemId}/weight`, { actualWeight }).then(() => undefined),
  reportIssue: (id: string, type: IssueType, detail: string) => http.post(`${base}/orders/${id}/issues`, { type, detail }).then(() => undefined),

  issues: (params: { page: number; limit: number }) => page<OrderIssue>(`${base}/issues`, params),
  resolveIssue: (id: string) => http.post(`${base}/issues/${id}/resolve`).then(() => undefined),

  inventory: (lowStock?: boolean) =>
    http.get<Envelope<InventoryRecord[]>>(`${base}/inventory`, { params: lowStock ? { lowStock: true } : undefined }).then(unwrapApiResponse),

  reviews: (params: { page: number; limit: number }) => page<StaffReview>(`${base}/reviews`, params),
  setReviewHidden: (id: string, isHidden: boolean) => http.patch(`${base}/reviews/${id}/visibility`, { isHidden }).then(() => undefined),

  supportSessions: (params: { page: number; limit: number }) => page<SupportSession>(`${base}/support/sessions`, params),
  claimSession: (id: string) => http.post(`${base}/support/sessions/${id}/claim`).then(() => undefined),
  sessionMessages: (id: string) => http.get<Envelope<SupportMessage[]>>(`${base}/support/sessions/${id}/messages`).then(unwrapApiResponse),
  reply: (id: string, content: string) => http.post(`${base}/support/sessions/${id}/messages`, { content }).then(() => undefined),
  closeSession: (id: string) => http.post(`${base}/support/sessions/${id}/close`).then(() => undefined),

  vouchers: () => http.get<Envelope<Array<Partial<AdminVoucherRecord> & { _id?: string }>>>(`${base}/vouchers`).then(unwrapApiResponse),
  createVoucher: (input: AdminVoucherInput) => http.post(`${base}/vouchers`, input).then(() => undefined),
  updateVoucher: (id: string, input: Partial<AdminVoucherInput>) => http.patch(`${base}/vouchers/${id}`, input).then(() => undefined),
  deleteVoucher: (id: string) => http.delete(`${base}/vouchers/${id}`).then(() => undefined),
};

export const staffApi = (isMockEnabled ? mockStaffApi : realStaffApi) as typeof realStaffApi;
