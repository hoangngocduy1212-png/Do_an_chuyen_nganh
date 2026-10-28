import type { PaymentMethod } from './order';

export interface PaymentRequestResult {
  paymentId: string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  qrCodeUrl?: string;
  paymentUrl?: string;
  paymentMethod: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  transferContent?: string;
  expiresAt?: string;
}