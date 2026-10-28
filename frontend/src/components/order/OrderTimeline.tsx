import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { OrderStatus, OrderTrackingEvent } from '../../types/order';

const deliveryStages: Array<{ status: OrderStatus; label: string }> = [
  { status: 'PENDING', label: 'Chờ xử lý' },
  { status: 'PREPARING', label: 'Đang chuẩn bị' },
  { status: 'SHIPPING', label: 'Đang giao' },
  { status: 'DELIVERED', label: 'Đã giao' },
];
const pickupStages: Array<{ status: OrderStatus; label: string }> = [
  { status: 'PENDING', label: 'Chờ xử lý' },
  { status: 'PREPARING', label: 'Đang chuẩn bị' },
  { status: 'READY_FOR_PICKUP', label: 'Sẵn sàng nhận tại cửa hàng' },
  { status: 'DELIVERED', label: 'Đã nhận' },
];
const eventLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  PREPARING: 'Đang chuẩn bị',
  SHIPPING: 'Đang giao',
  READY_FOR_PICKUP: 'Sẵn sàng nhận tại cửa hàng',
  DELIVERED: 'Đã giao',
  WAITING_PICKUP: 'Chờ đơn vị vận chuyển lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  FAILED: 'Giao hàng chưa thành công',
  PICKED_UP: 'Đã lấy hàng',
};

export function OrderTimeline({ status, pickup = false, events = [] }: { status: OrderStatus; pickup?: boolean; events?: OrderTrackingEvent[] }) {
  const reducedMotion = useReducedMotion();
  const stages = status === 'CANCELLED'
    ? [{ status: 'CANCELLED' as const, label: 'Đã hủy' }]
    : status === 'RETURNING' || status === 'RETURNED'
      ? [{ status: 'RETURNING' as const, label: 'Đang trả hàng' }, ...(status === 'RETURNED' ? [{ status: 'RETURNED' as const, label: 'Đã trả hàng' }] : [])]
      : pickup ? pickupStages : deliveryStages;
  const activeIndex = stages.findIndex((stage) => stage.status === status);
  const completion = activeIndex <= 0 ? 0 : activeIndex / Math.max(stages.length - 1, 1);
  return <ol className="order-timeline" aria-label="Tiến trình đơn hàng" style={{ '--timeline-progress': completion } as CSSProperties & { '--timeline-progress': number }}>
    {stages.map((step, index) => {
      const event = events.find((item) => item.status.toLocaleUpperCase() === step.status);
      return <motion.li className={`order-timeline-step ${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'current' : ''}`} key={step.status}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.25, delay: reducedMotion ? 0 : index * 0.08 }}>
        <i aria-hidden="true" /><div><strong>{step.label}</strong>{event && <small>{new Date(event.time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}{event.status && ` · ${eventLabels[event.status.toLocaleUpperCase()] ?? event.status}`}{event.location ? ` · ${event.location}` : ''}</small>}</div>
      </motion.li>;
    })}
  </ol>;
}
