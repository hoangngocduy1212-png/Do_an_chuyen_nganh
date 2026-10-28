import { http, isMockEnabled, unwrapApiResponse } from './client';
import type { PaymentMethod } from '../types/order';
import type { PaymentRequestResult } from '../types/payment';
import type { OrderPayment } from '../types/order';
import { mockOrders } from './mock/account';
import { MockApiError, mockScenario, type MockPaymentStatus } from './mock/scenarios';

const MOCK_PAYMENT_PREFIX = 'muadee-mock-payment-';
function saveMockPayment(orderId: string, payment: PaymentRequestResult) {
  localStorage.setItem(`${MOCK_PAYMENT_PREFIX}${orderId}`, JSON.stringify(payment));
}
function readMockPayment(orderId: string): PaymentRequestResult | null {
  try { return JSON.parse(localStorage.getItem(`${MOCK_PAYMENT_PREFIX}${orderId}`) ?? 'null') as PaymentRequestResult | null; }
  catch { return null; }
}

export const paymentsApi = {
  create: async (orderId: string, paymentMethod: PaymentMethod, amount?: number): Promise<PaymentRequestResult> => {
    if (isMockEnabled) {
      if (paymentMethod === 'CASH') return { paymentId: '', paymentStatus: 'PENDING', paymentMethod, amount };
      const paymentId = `mock-payment-${orderId}-${Date.now()}`;
      const configuredStatus: MockPaymentStatus = import.meta.env.VITE_MOCK_PAYMENT_STATUS
        ?? (paymentMethod === 'TRANSFER' ? mockScenario.transferStatus : mockScenario.cardStatus);
      const expired = configuredStatus === 'EXPIRED';
      const paymentStatus = expired ? 'FAILED' : configuredStatus;
      const created: PaymentRequestResult = {
        paymentId,
        paymentStatus,
        paymentMethod,
        amount,
        createdAt: new Date().toISOString(),
        transactionId: paymentStatus === 'SUCCESS' ? `TX-${paymentId}` : undefined,
        paidAt: paymentStatus === 'SUCCESS' ? new Date().toISOString() : undefined,
        qrCodeUrl: paymentMethod === 'TRANSFER' ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`MUAdEE|${orderId}|${amount ?? ''}`)}` : undefined,
        qrImageUrl: paymentMethod === 'TRANSFER' ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`MUAdEE|${orderId}|${amount ?? ''}`)}` : undefined,
        paymentUrl: paymentMethod === 'CARD' ? `${window.location.origin}/payment/result?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}` : undefined,
        bankName: paymentMethod === 'TRANSFER' ? 'Ngân hàng TMCP Ngoại thương Việt Nam' : undefined,
        accountNumber: paymentMethod === 'TRANSFER' ? '0123456789' : undefined,
        accountName: paymentMethod === 'TRANSFER' ? 'CONG TY TNHH MUADEE' : undefined,
        transferContent: paymentMethod === 'TRANSFER' ? `MD${orderId.slice(-8)}` : undefined,
        expiresAt: new Date(Date.now() + (expired ? -1000 : 15 * 60_000)).toISOString(),
      };
      saveMockPayment(orderId, created);
      return created;
    }
    return http.post<{ success: true; data: PaymentRequestResult }>('/payments', { orderId, paymentMethod }).then(unwrapApiResponse);
  },
  get: async (paymentId: string): Promise<PaymentRequestResult> => {
    if (isMockEnabled) {
      let payment: PaymentRequestResult | null = null;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(MOCK_PAYMENT_PREFIX)) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) ?? 'null') as PaymentRequestResult | null;
          if (value?.paymentId === paymentId) { payment = value; break; }
        } catch { /* Ignore stale mock transaction storage. */ }
      }
      const orderId = paymentId.replace(/^mock-payment-/, '').replace(/-\d+$/, '');
      payment ??= readMockPayment(orderId);
      if (!payment) throw new MockApiError('Không tìm thấy giao dịch thanh toán.', 'PAYMENT_NOT_FOUND');
      const configuredStatus = import.meta.env.VITE_MOCK_PAYMENT_STATUS
        ?? (payment.paymentMethod === 'TRANSFER' ? mockScenario.transferStatus : mockScenario.cardStatus);
      if (configuredStatus === 'SUCCESS' && payment.paymentStatus === 'PENDING') {
        payment = { ...payment, paymentStatus: 'SUCCESS', transactionId: `TX-${payment.paymentId}`, paidAt: new Date().toISOString() };
        saveMockPayment(orderId, payment);
      }
      if (configuredStatus === 'FAILED' && payment.paymentStatus === 'PENDING') {
        payment = { ...payment, paymentStatus: 'FAILED' };
        saveMockPayment(orderId, payment);
      }
      if (configuredStatus === 'EXPIRED' && payment.paymentStatus === 'PENDING') {
        payment = { ...payment, paymentStatus: 'FAILED', expiresAt: new Date(Date.now() - 1000).toISOString() };
        saveMockPayment(orderId, payment);
      }
      if (payment.expiresAt && Date.parse(payment.expiresAt) < Date.now() && payment.paymentStatus === 'PENDING') return { ...payment, paymentStatus: 'FAILED' };
      return payment;
    }
    return http.get<{ success: true; data: PaymentRequestResult }>(`/payments/${paymentId}`).then(unwrapApiResponse);
  },
  forOrder: async (orderId: string): Promise<PaymentRequestResult | null> => {
    if (isMockEnabled) return readMockPayment(orderId);
    return http.get<{ success: true; data: PaymentRequestResult[] }>(`/orders/${orderId}/payments`).then(unwrapApiResponse).then((payments) => payments[0] ?? null);
  },
  history: async (orderId: string): Promise<OrderPayment[]> => {
    if (isMockEnabled) {
      const payment = readMockPayment(orderId);
      if (payment) return [{ ...payment, createdAt: payment.createdAt, amount: payment.amount }];
      const storedOrders = (() => {
        try {
          const value: unknown = JSON.parse(localStorage.getItem('muadee-mock-orders') ?? '[]');
          return Array.isArray(value) ? value as typeof mockOrders : [];
        } catch { return []; }
      })();
      const order = [...storedOrders, ...mockOrders].find((item) => item.orderId === orderId);
      return order?.paymentMethod ? [{ paymentId: order.transactionId ?? `mock-${order.orderId}`, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus ?? 'PENDING', amount: order.totalAmount, transactionId: order.transactionId, createdAt: order.createdAt, paidAt: order.paidAt }] : [];
    }
    return http.get<{ success: true; data: OrderPayment[] }>(`/orders/${orderId}/payments`).then(unwrapApiResponse);
  },
  retry: async (orderId: string, paymentMethod: PaymentMethod, amount?: number) => paymentsApi.create(orderId, paymentMethod, amount),
};