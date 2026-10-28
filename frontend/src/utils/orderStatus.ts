import type { OrderStatus } from '../types/order';

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: 'Chờ xử lý', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao', READY_FOR_PICKUP: 'Sẵn sàng nhận tại cửa hàng', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy', RETURNING: 'Đang trả hàng', RETURNED: 'Đã trả hàng',
};

export const orderStatusTone: Record<OrderStatus, string> = {
  PENDING: 'pending', PREPARING: 'preparing', SHIPPING: 'shipping', READY_FOR_PICKUP: 'preparing', DELIVERED: 'delivered', CANCELLED: 'cancelled', RETURNING: 'pending', RETURNED: 'cancelled',
};