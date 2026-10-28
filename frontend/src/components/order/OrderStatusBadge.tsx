import type { OrderStatus } from '../../types/order';
import { orderStatusLabel, orderStatusTone } from '../../utils/orderStatus';

export function OrderStatusBadge({ status, pickup = false }: { status: OrderStatus; pickup?: boolean }) {
  const label = pickup && status === 'DELIVERED' ? 'Đã nhận' : orderStatusLabel[status];
  return <span className={`order-status-badge ${orderStatusTone[status]}`} role="status">{label}</span>;
}