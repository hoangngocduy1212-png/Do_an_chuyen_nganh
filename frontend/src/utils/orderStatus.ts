import type { OrderStatus } from '../types/order';

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao hàng', READY_FOR_PICKUP: 'Chờ nhận tại cửa hàng', DELIVERED: 'Đã giao hàng', CANCELLED: 'Đã hủy', RETURNING: 'Đang hoàn trả', RETURNED: 'Đã hoàn trả',
};

export const orderStatusTone: Record<OrderStatus, string> = {
  PENDING: 'pending', PREPARING: 'preparing', SHIPPING: 'shipping', READY_FOR_PICKUP: 'preparing', DELIVERED: 'delivered', CANCELLED: 'cancelled', RETURNING: 'pending', RETURNED: 'cancelled',
};