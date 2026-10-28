import { useSyncExternalStore } from 'react';

export interface CheckoutState {
  voucherCode: string;
  discountAmount: number;
  receiveMethod: 'DELIVERY' | 'PICKUP';
  addressId: string;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  pickupTime: string;
  pickupNote: string;
  orderNote: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  idempotencyKey: string;
  initialized: boolean;
}

const STORAGE_KEY = 'muadee-checkout';
const EMPTY_STATE: CheckoutState = { voucherCode: '', discountAmount: 0, receiveMethod: 'DELIVERY', addressId: '', shippingAddress: '', recipientName: '', recipientPhone: '', pickupTime: '', pickupNote: '', orderNote: '', paymentMethod: 'CASH', idempotencyKey: '', initialized: false };
function readState(): CheckoutState {
  try { return { ...EMPTY_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<CheckoutState> }; }
  catch { return EMPTY_STATE; }
}

let state = readState();
const listeners = new Set<() => void>();
function publish(next: CheckoutState) {
  state = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export function useCheckout() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state, () => EMPTY_STATE);
}

export const checkoutStore = {
  update: (patch: Partial<CheckoutState>) => publish({ ...state, ...patch }),
  applyVoucher: (voucherCode: string, discountAmount: number) => publish({ ...state, voucherCode, discountAmount }),
  clearVoucher: () => publish({ ...state, voucherCode: '', discountAmount: 0 }),
  clear: () => publish(EMPTY_STATE),
  getIdempotencyKey: () => {
    if (!state.idempotencyKey) publish({ ...state, idempotencyKey: crypto.randomUUID() });
    return state.idempotencyKey;
  },
  renewIdempotencyKey: () => publish({ ...state, idempotencyKey: crypto.randomUUID() }),
  resetAfterOrder: () => publish({ ...EMPTY_STATE, initialized: false, idempotencyKey: crypto.randomUUID() }),
  setOrderPaymentMethod: (orderId: string, paymentMethod: 'CASH' | 'CARD' | 'TRANSFER') => localStorage.setItem(`muadee-order-payment-${orderId}`, paymentMethod),
  getOrderPaymentMethod: (orderId: string) => localStorage.getItem(`muadee-order-payment-${orderId}`) as 'CASH' | 'CARD' | 'TRANSFER' | null,
  setPayment: (orderId: string, payment: unknown) => localStorage.setItem(`muadee-order-payment-data-${orderId}`, JSON.stringify(payment)),
  getPayment: <T,>(orderId: string): T | null => {
    try { return JSON.parse(localStorage.getItem(`muadee-order-payment-data-${orderId}`) ?? 'null') as T | null; }
    catch { return null; }
  },
};