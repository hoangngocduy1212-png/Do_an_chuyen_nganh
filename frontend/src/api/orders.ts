import type { CustomerOrder } from '../types/order';
import { mockOrders } from './mock/account';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import type { PaymentMethod } from '../types/order';
import { errorMessage } from './client';

const MOCK_ORDERS_KEY = 'muadee-mock-orders';
function readMockOrders(): CustomerOrder[] {
  try { return JSON.parse(localStorage.getItem(MOCK_ORDERS_KEY) ?? '[]') as CustomerOrder[]; }
  catch { return []; }
}
const mockPlacedOrders: CustomerOrder[] = readMockOrders();
function persistMockOrders() { localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(mockPlacedOrders)); }

export const ordersApi = {
  mine: async (limit = 20): Promise<CustomerOrder[]> => isMockEnabled
    ? import.meta.env.VITE_MOCK_ORDERS_EMPTY === 'true' ? [] : import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'orders' ? Promise.reject(new Error('Không tải được đơn hàng')) : [...mockPlacedOrders, ...mockOrders].slice(0, limit)
    : http.get<{ success: true; data: CustomerOrder[] }>('/orders/my', { params: { limit } }).then(unwrapApiResponse),
  get: async (orderId: string): Promise<CustomerOrder> => {
    if (isMockEnabled) {
      const order = [...mockPlacedOrders, ...mockOrders].find((item) => item.orderId === orderId || item.orderCode === orderId);
      if (!order) throw new Error('Không tìm thấy đơn hàng');
      return order;
    }
    return http.get<{ success: true; data: CustomerOrder }>(`/orders/${orderId}`).then(unwrapApiResponse);
  },
  create: async (input: { storeId: string; receiveMethod: 'DELIVERY' | 'PICKUP'; shippingAddress?: string; recipientName?: string; recipientPhone?: string; pickupTime?: string; pickupNote?: string; note?: string; voucherCode?: string }, idempotencyKey: string, estimatedTotal = 0): Promise<CustomerOrder> => {
    if (isMockEnabled) {
      const createdAt = new Date();
      const order: CustomerOrder = { orderId: `mock-order-${Date.now()}`, orderCode: `MD${Date.now().toString().slice(-8)}`, orderStatus: 'PENDING', totalAmount: estimatedTotal, discountAmount: 0, shippingFee: input.receiveMethod === 'DELIVERY' ? 20000 : 0, createdAt: createdAt.toISOString(), estimatedDeliveryAt: new Date(createdAt.getTime() + 2 * 60 * 60_000).toISOString(), ...input, paymentStatus: 'PENDING' };
      mockPlacedOrders.unshift(order);
      persistMockOrders();
      return order;
    }
    try { return await http.post<{ success: true; data: CustomerOrder }>('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } }).then(unwrapApiResponse); }
    catch (error) {
      const response = typeof error === 'object' && error !== null && 'response' in error ? (error as { response?: { data?: { error?: { code?: string; message?: string } } } }).response : undefined;
      const code = response?.data?.error?.code;
      const normalized = new Error(response?.data?.error?.message ?? (code ? errorMessage(error) : 'Không thể kết nối, vui lòng thử lại'));
      Object.assign(normalized, { code: code ?? 'NETWORK' });
      throw normalized;
    }
  },
  cancel: async (orderId: string) => http.post(`/orders/${orderId}/cancel`).then((response) => response.data),
  return: async (orderId: string, reason: string) => http.post(`/orders/${orderId}/return`, { reason }).then((response) => response.data),
  tracking: async (orderId: string) => http.get<{ success: true; data: { events: Array<{ time: string; status: string; location?: string }>; carrierName?: string; trackingCode?: string } }>(`/orders/${orderId}/tracking`).then(unwrapApiResponse),
};