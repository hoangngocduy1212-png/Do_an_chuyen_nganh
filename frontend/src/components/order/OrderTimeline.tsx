import type { OrderStatus } from '../../types/order';

const stages: OrderStatus[] = ['PENDING', 'PREPARING', 'SHIPPING', 'DELIVERED'];
const pickupStages: OrderStatus[] = ['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED'];
const labels: Record<OrderStatus, string> = { PENDING: 'Đã đặt hàng', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao', READY_FOR_PICKUP: 'Sẵn sàng nhận', DELIVERED: 'Hoàn tất', CANCELLED: 'Đã hủy', RETURNING: 'Đang hoàn trả', RETURNED: 'Đã hoàn trả' };

export function OrderTimeline({ status, pickup = false, events = [] }: { status: OrderStatus; pickup?: boolean; events?: Array<{ time: string; status: string; location?: string }> }) {
  const steps = pickup ? pickupStages : stages;
  const activeIndex = steps.indexOf(status);
  return <div className="order-timeline">{steps.map((step, index) => <div className={`order-timeline-step ${activeIndex >= index ? 'complete' : ''}`} key={step}><i /><div><strong>{labels[step]}</strong>{events[index] && <small>{new Date(events[index].time).toLocaleString('vi-VN')} · {events[index].status}{events[index].location ? ` · ${events[index].location}` : ''}</small>}</div></div>)}</div>;
}