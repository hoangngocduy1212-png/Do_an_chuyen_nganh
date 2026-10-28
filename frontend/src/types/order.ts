export type OrderStatus = 'PENDING' | 'PREPARING' | 'SHIPPING' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELLED' | 'RETURNING' | 'RETURNED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CustomerOrder {
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  totalAmount: number;
  discountAmount?: number;
  shippingFee?: number;
  createdAt: string;
  receiveMethod?: 'DELIVERY' | 'PICKUP';
  pickupTime?: string;
  pickupNote?: string;
  note?: string;
  recipientName?: string;
  recipientPhone?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  items?: Array<{ itemId: string; productId: string; productName: string; image?: string; quantity: number; unit: string; price: number; actualWeight?: number }>;
  shippingAddress?: string;
  storeId?: string;
  estimatedDeliveryAt?: string;
  trackingCode?: string;
  carrierName?: string;
}