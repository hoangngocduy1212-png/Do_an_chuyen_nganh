import { http, isMockEnabled, unwrapApiResponse } from './client';
import type { PaymentMethod } from '../types/order';
import type { PaymentRequestResult } from '../types/payment';

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
      const paymentId = `mock-payment-${orderId}-${Date.now()}`;
      const created: PaymentRequestResult = { paymentId, paymentStatus: paymentMethod === 'CASH' ? 'SUCCESS' : import.meta.env.VITE_MOCK_PAYMENT_STATUS === 'FAILED' ? 'FAILED' : import.meta.env.VITE_MOCK_PAYMENT_STATUS === 'SUCCESS' ? 'SUCCESS' : 'PENDING', paymentMethod, amount, qrCodeUrl: paymentMethod === 'TRANSFER' ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`MUAdEE|${orderId}|${amount ?? ''}`)}` : undefined, paymentUrl: paymentMethod === 'CARD' ? `${window.location.origin}/payment/result?orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(paymentId)}` : undefined, bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam', accountNumber: '0123456789', accountName: 'CONG TY TNHH MUADEE', transferContent: `MD${orderId.slice(-8)}`, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
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
      if (!payment) throw new Error('Không tìm thấy giao dịch thanh toán');
      if (import.meta.env.VITE_MOCK_PAYMENT_STATUS === 'SUCCESS' && payment.paymentStatus === 'PENDING') {
        payment = { ...payment, paymentStatus: 'SUCCESS' };
        saveMockPayment(orderId, payment);
      }
      if (payment.expiresAt && Date.parse(payment.expiresAt) < Date.now() && payment.paymentStatus === 'PENDING') return { ...payment, paymentStatus: 'FAILED' };
      return payment;
    }
    return http.get<{ success: true; data: PaymentRequestResult }>(`/payments/${paymentId}`).then(unwrapApiResponse);
  },
  forOrder: async (orderId: string): Promise<PaymentRequestResult> => {
    if (isMockEnabled) return readMockPayment(orderId) ?? { paymentId: `mock-payment-${orderId}`, paymentStatus: 'PENDING', paymentMethod: 'TRANSFER', bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam', accountNumber: '0123456789', accountName: 'CONG TY TNHH MUADEE', transferContent: `MD${orderId.slice(-8)}` };
    return http.get<{ success: true; data: PaymentRequestResult[] }>(`/orders/${orderId}/payments`).then(unwrapApiResponse).then((payments) => payments[0]);
  },
  retry: async (orderId: string, paymentMethod: PaymentMethod, amount?: number) => paymentsApi.create(orderId, paymentMethod, amount),
};