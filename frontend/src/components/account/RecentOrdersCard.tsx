import { ArrowRight, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CustomerOrder, OrderStatus } from '../../types/order';

const statusLabels: Record<OrderStatus, string> = { PENDING: 'Chờ xử lý', PREPARING: 'Đang chuẩn bị', READY_FOR_PICKUP: 'Sẵn sàng nhận tại cửa hàng', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy', RETURNING: 'Đang trả hàng', RETURNED: 'Đã trả hàng' };

export function RecentOrdersCard({ orders }: { orders: CustomerOrder[] }) {
  return <section className="account-panel recent-orders-card">
    <header className="account-panel-heading"><div><span className="section-eyebrow">THEO DÕI MUA SẮM</span><h2>Đơn hàng gần đây</h2></div><Link to="/orders" className="account-text-link">Xem tất cả <ArrowRight size={15} /></Link></header>
    {orders.length ? <div className="recent-orders-list">{orders.slice(0, 3).map((order) => <article className="recent-order-row" key={order.orderId}><div className="recent-order-main"><strong>#{order.orderCode}</strong><span>{new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div><div className="recent-order-detail"><strong>{order.totalAmount.toLocaleString('vi-VN')}đ</strong><span className={`order-status status-${order.orderStatus.toLowerCase()}`}>{statusLabels[order.orderStatus]}</span></div></article>)}</div> : <div className="account-empty"><PackageOpen size={27} /><p>Bạn chưa có đơn hàng nào</p><Link className="primary-button account-small-button" to="/products">Mua sắm ngay</Link></div>}
  </section>;
}