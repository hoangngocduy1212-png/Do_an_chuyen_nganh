export type MockCartMode = 'empty' | 'multiple' | 'changes' | 'network-error';
export type MockOrderCreateMode = 'normal' | 'out-of-stock' | 'store-unavailable' | 'network-error';
export type MockVoucherMode = 'normal' | 'invalid' | 'expired' | 'minimum' | 'used' | 'network-error';
export type MockPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
export type MockTrackingMode = 'normal' | 'failed' | 'network-error';

export class MockApiError<TDetails = undefined> extends Error {
  readonly success = false;
  readonly error: { code: string; message: string; details?: TDetails };

  constructor(message: string, readonly code: string, readonly details?: TDetails) {
    super(message);
    this.name = 'MockApiError';
    this.error = { code, message, ...(details === undefined ? {} : { details }) };
  }
}

export const mockScenario = {
  cartMode: (import.meta.env.VITE_MOCK_CART_MODE ?? 'empty') as MockCartMode,
  orderCreateMode: (import.meta.env.VITE_MOCK_ORDER_CREATE_MODE ?? 'normal') as MockOrderCreateMode,
  voucherMode: (import.meta.env.VITE_MOCK_VOUCHER_MODE ?? 'normal') as MockVoucherMode,
  transferStatus: (import.meta.env.VITE_MOCK_TRANSFER_STATUS ?? 'PENDING') as MockPaymentStatus,
  cardStatus: (import.meta.env.VITE_MOCK_CARD_STATUS ?? 'PENDING') as MockPaymentStatus,
  trackingMode: (import.meta.env.VITE_MOCK_TRACKING_MODE ?? 'normal') as MockTrackingMode,
  deliveryAddressMode: import.meta.env.VITE_MOCK_DELIVERY_ADDRESS_MODE ?? 'auto',
};

// Đổi chế độ trong .env.local rồi tải lại để kiểm tra từng kịch bản mock.
