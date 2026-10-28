import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, PackageCheck } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { CancelOrderDialog } from '../../components/order/CancelOrderDialog';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { ReturnOrderDialog } from '../../components/order/ReturnOrderDialog';
import type { CustomerOrder } from '../../types/order';
import { formatMoney } from '../../utils/money';

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<CustomerOrder>();
  const [events, setEvents] = useState<Array<{ time: string; status: string; location?: string }>>([]);
  const [dialog, setDialog] = useState<'cancel' | 'return' | null>(null);
  const [error, setError] = useState(false);
  async function refresh() { try { const result = await ordersApi.get(id); setOrder(result); if (result.orderStatus === 'SHIPPING') { const tracking = await ordersApi.tracking(id); setEvents(tracking.events); } } catch { setError(true); } }
  useEffect(() => { void refresh(); }, [id]);
  async function cancel(reason: string) { try { await ordersApi.cancel(id); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: reason ? 'Đơn hàng đã được hủy' : 'Đã gửi yêu cầu hủy đơn' })); setDialog(null); await refresh(); } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể hủy đơn hàng này.' })); } }
  async function requestReturn(reason: string) { try { await ordersApi.return(id, reason); setDialog(null); await refresh(); } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể gửi yêu cầu đổi trả.' })); } }
  if (error) return <div className="customer-shell order-detail-page"><div className="listing-message"><strong>Không tìm thấy đơn hàng</strong><Link to="/orders">Quay lại đơn hàng của tôi</Link></div></div>;
  if (!order) return <div className="customer-shell order-detail-page"><div className="cart-loading"><i /></div></div>;
  return <div className="customer-shell order-detail-page"><Link className="orders-back" to="/orders"><ArrowLeft size={15} />Đơn hàng của tôi</Link><header className="order-detail-heading"><div><span className="section-eyebrow">MÃ ĐƠN {order.orderCode}</span><h1>Chi tiết đơn hàng</h1><time>{new Date(order.createdAt).toLocaleString('vi-VN')}</time></div><OrderStatusBadge status={order.orderStatus} /></header><div className="order-detail-layout"><section className="order-detail-main"><article className="order-detail-section"><h2><PackageCheck size={18} />Trạng thái đơn hàng</h2><OrderTimeline status={order.orderStatus} pickup={order.receiveMethod === 'PICKUP'} events={events} />{order.trackingCode && <p className="tracking-meta">Đơn vị vận chuyển: {order.carrierName ?? 'Đối tác giao hàng'} · Mã vận đơn: {order.trackingCode}</p>}</article><article className="order-detail-section"><h2><MapPin size={18} />Thông tin nhận hàng</h2><p>{order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng đã chọn' : order.shippingAddress || 'Địa chỉ giao hàng'}</p></article><article className="order-detail-section"><h2>Sản phẩm</h2>{order.items?.map((item) => <div className="order-line" key={item.itemId}><span>{item.productName} · {item.actualWeight ?? item.quantity} {item.unit}</span><strong>{formatMoney(item.price * (item.actualWeight ?? item.quantity))}</strong></div>)}</article></section><aside className="order-detail-summary"><h2>Thanh toán</h2><p>Phương thức <strong>{order.paymentMethod === 'CASH' ? 'Thanh toán khi nhận hàng' : order.paymentMethod === 'CARD' ? 'Thẻ ngân hàng' : 'Chuyển khoản QR'}</strong></p><p>Trạng thái <strong>{order.paymentStatus ?? 'Đang chờ thanh toán'}</strong></p><div className="checkout-total"><span>Tổng cộng</span><strong>{formatMoney(order.totalAmount)}</strong></div>{order.orderStatus === 'PENDING' && <button type="button" className="order-action-cancel" onClick={() => setDialog('cancel')}>Hủy đơn hàng</button>}{order.orderStatus === 'DELIVERED' && <button type="button" className="order-action-return" onClick={() => setDialog('return')}>Yêu cầu đổi trả</button>}</aside></div><CancelOrderDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} onConfirm={(reason) => void cancel(reason)} /><ReturnOrderDialog open={dialog === 'return'} onClose={() => setDialog(null)} onConfirm={(reason) => void requestReturn(reason)} /></div>;
}