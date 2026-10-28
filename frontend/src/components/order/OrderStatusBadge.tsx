import type { OrderStatus } from '../../types/order';
import { orderStatusLabel, orderStatusTone } from '../../utils/orderStatus';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`order-status-badge ${orderStatusTone[status]}`}>{orderStatusLabel[status]}</span>;
}