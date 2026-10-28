export type OrderStatus = 'PENDING' | 'PREPARING' | 'SHIPPING' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELLED' | 'RETURNING' | 'RETURNED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CustomerOrder {
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  totalAmount: number;
  subtotal?: number;
  itemCount?: number;
  discountAmount?: number;
  shippingFee?: number;
  voucherCode?: string;
  createdAt: string;
  receiveMethod?: 'DELIVERY' | 'PICKUP';
  pickupTime?: string;
  pickupNote?: string;
  note?: string;
  recipientName?: string;
  recipientPhone?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  transactionId?: string;
  paidAt?: string;
  items?: Array<{ itemId: string; productId: string; productName: string; image?: string; quantity: number; unit: string; price: number; actualWeight?: number }>;
  shippingAddress?: string;
  storeId?: string;
  estimatedDeliveryAt?: string;
  trackingCode?: string;
  carrierName?: string;
}

export interface OrderTrackingEvent {
  time: string;
  status: string;
  location?: string;
}

export interface OrderPayment {
  paymentId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | string;
  amount?: number;
  transactionId?: string;
  createdAt?: string;
  paidAt?: string;
}