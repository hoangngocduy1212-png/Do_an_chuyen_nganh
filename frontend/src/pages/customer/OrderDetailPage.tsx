import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, MapPin, PackageCheck, RotateCw, Store as StoreIcon } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { paymentsApi } from '../../api/payments';
import { storesApi } from '../../api/stores';
import { CancelOrderDialog } from '../../components/order/CancelOrderDialog';
import { EditShippingInfoDialog } from '../../components/order/EditShippingInfoDialog';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { ReturnOrderDialog } from '../../components/order/ReturnOrderDialog';
import { ProductImage } from '../../components/product/ProductImage';
import type { CustomerOrder, OrderPayment, OrderTrackingEvent } from '../../types/order';
import type { StoreLocation } from '../../types/store';
import { formatMoney } from '../../utils/money';
import { checkoutStore } from '../../store/checkoutStore';

interface TrackingInfo {
  events: OrderTrackingEvent[];
  carrierName?: string;
  trackingCode?: string;
  status?: string;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Đang cập nhật';
}

function paymentLabel(status?: string) {
  const labels: Record<string, string> = { PENDING: 'Chờ thanh toán', SUCCESS: 'Thành công', PAID: 'Thành công', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền' };
  return status ? labels[status] ?? status : 'Chờ thanh toán';
}

function methodLabel(method?: CustomerOrder['paymentMethod']) {
  if (method === 'CASH') return 'Thanh toán khi nhận hàng';
  if (method === 'CARD') return 'Thẻ ngân hàng';
  if (method === 'TRANSFER') return 'Chuyển khoản QR';
  return 'Đang cập nhật';
}

function weight(value: number) {
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
}

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<CustomerOrder>();
  const [events, setEvents] = useState<OrderTrackingEvent[]>([]);
  const [tracking, setTracking] = useState<TrackingInfo>();
  const [trackingError, setTrackingError] = useState(false);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [paymentsError, setPaymentsError] = useState(false);
  const [store, setStore] = useState<StoreLocation>();
  const [dialog, setDialog] = useState<'cancel' | 'return' | 'edit' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const loadOrder = useCallback(async () => {
    setError(false);
    try { setOrder(await ordersApi.get(id)); }
    catch { setError(true); }
  }, [id]);

  const loadTracking = useCallback(async () => {
    setTrackingError(false);
    try {
      const result = await ordersApi.tracking(id);
      setTracking(result);
      setEvents(result.events);
    } catch { setTrackingError(true); }
  }, [id]);

  const loadPayments = useCallback(async () => {
    setPaymentsError(false);
    try { setPayments(await paymentsApi.history(id)); }
    catch { setPaymentsError(true); }
  }, [id]);

  useEffect(() => { void loadOrder(); void loadPayments(); }, [loadOrder, loadPayments]);
  useEffect(() => {
    if (order?.receiveMethod === 'PICKUP') {
      storesApi.list().then((items) => setStore(items.find((item) => item._id === order.storeId))).catch(() => setStore(undefined));
    }
    if (order?.receiveMethod !== 'DELIVERY' || !['SHIPPING', 'DELIVERED'].includes(order.orderStatus)) return;
    void loadTracking();
    if (order.orderStatus !== 'SHIPPING') return;
    const timer = window.setInterval(() => { void loadTracking(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadTracking, order?.orderStatus, order?.receiveMethod, order?.storeId]);

  async function cancel(reason: string) {
    setBusy(true);
    try {
      await ordersApi.cancel(id, reason);
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đơn hàng đã được hủy' }));
      setDialog(null);
      await loadOrder();
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể hủy đơn hàng này. Vui lòng thử lại.' })); }
    finally { setBusy(false); }
  }

  async function requestReturn(reason: string, description: string) {
    setBusy(true);
    try {
      await ordersApi.return(id, reason, description);
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã gửi yêu cầu trả hàng' }));
      setDialog(null);
      await loadOrder();
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể gửi yêu cầu trả hàng. Vui lòng thử lại.' })); }
    finally { setBusy(false); }
  }

  async function updateShippingInfo(value: { recipientName?: string; recipientPhone?: string; shippingAddress?: string; pickupTime?: string; pickupNote?: string }) {
    setBusy(true);
    try {
      await ordersApi.updateShippingInfo(id, value);
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã cập nhật thông tin nhận hàng' }));
      setDialog(null);
      await loadOrder();
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể cập nhật thông tin nhận hàng. Vui lòng thử lại.' })); }
    finally { setBusy(false); }
  }

  async function copyTrackingCode() {
    if (!tracking?.trackingCode && !order?.trackingCode) return;
    try {
      await navigator.clipboard.writeText(tracking?.trackingCode ?? order?.trackingCode ?? '');
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã sao chép mã vận đơn' }));
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Không thể sao chép mã vận đơn.' })); }
  }

  const subtotal = useMemo(() => order?.items?.reduce((sum, item) => sum + item.price * (item.actualWeight ?? item.quantity), 0) ?? 0, [order?.items]);
  if (error) return <div className="customer-shell order-detail-page"><div className="listing-message" role="alert"><strong>Không tải được dữ liệu</strong><p>Vui lòng thử lại để xem chi tiết đơn hàng.</p><button type="button" onClick={() => void loadOrder()}><RotateCw size={15} /> Thử lại</button><Link to="/orders">Quay lại đơn hàng của tôi</Link></div></div>;
  if (!order) return <div className="customer-shell order-detail-page"><div className="cart-loading" aria-label="Đang tải chi tiết đơn hàng"><i /><i /></div></div>;

  const delivered = order.orderStatus === 'DELIVERED';
  const preparationOngoing = ['PREPARING', 'SHIPPING', 'READY_FOR_PICKUP'].includes(order.orderStatus);
  const trackingStatus = (tracking?.status ?? events.at(-1)?.status ?? 'WAITING_PICKUP').toLocaleUpperCase();
  const shippingStatusLabels: Record<string, string> = { WAITING_PICKUP: 'Chờ đơn vị vận chuyển lấy hàng', PICKED_UP: 'Đã lấy hàng', IN_TRANSIT: 'Đang vận chuyển', DELIVERED: 'Đã giao hàng', FAILED: 'Giao hàng chưa thành công' };
  const trackingAvailable = order.receiveMethod === 'DELIVERY' && ['SHIPPING', 'DELIVERED'].includes(order.orderStatus);
  const paymentSucceeded = ['SUCCESS', 'PAID'].includes(order.paymentStatus ?? '') || payments.some((payment) => payment.paymentStatus === 'SUCCESS');
  const paymentMethod = order.paymentMethod ?? checkoutStore.getOrderPaymentMethod(id) ?? undefined;

  return <div className="customer-shell order-detail-page">
    <Link className="orders-back" to="/orders"><ArrowLeft size={15} />Đơn hàng của tôi</Link>
    <header className="order-detail-heading"><div><span className="section-eyebrow">MÃ ĐƠN {order.orderCode}</span><h1>Chi tiết đơn hàng</h1><time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time></div><OrderStatusBadge status={order.orderStatus} pickup={order.receiveMethod === 'PICKUP'} /></header>
    <article className="order-detail-section order-progress-section"><h2><PackageCheck size={18} />Trạng thái đơn hàng</h2><OrderTimeline status={order.orderStatus} pickup={order.receiveMethod === 'PICKUP'} events={events} /></article>

    <div className="order-detail-layout">
      <section className="order-detail-main">
        {trackingAvailable && <article className="order-detail-section tracking-section"><h2><MapPin size={18} />Hành trình giao hàng</h2>
          {trackingError ? <div className="order-inline-error" role="alert"><span>Không tải được dữ liệu theo dõi.</span><button type="button" onClick={() => void loadTracking()}><RotateCw size={14} />Thử lại</button></div>
            : <><div className="tracking-facts"><p>Đơn vị vận chuyển<strong>{tracking?.carrierName ?? order.carrierName ?? 'Đối tác giao hàng'}</strong></p><p>Mã vận đơn<strong>{tracking?.trackingCode ?? order.trackingCode ?? 'Đang cập nhật'}{(tracking?.trackingCode ?? order.trackingCode) && <button type="button" aria-label="Sao chép mã vận đơn" onClick={() => void copyTrackingCode()}><Copy size={14} /></button>}</strong></p><p>Trạng thái<strong>{shippingStatusLabels[trackingStatus] ?? trackingStatus}</strong></p></div>
              {events.length ? <ol className="tracking-event-list">{[...events].reverse().map((event, index) => <li key={`${event.time}-${index}`}><strong>{shippingStatusLabels[event.status] ?? event.status}</strong><time>{formatDate(event.time)}</time>{event.location && <span>{event.location}</span>}</li>)}</ol> : <p className="tracking-pending">Chưa có sự kiện vận chuyển mới.</p>}</>}
        </article>}
        {order.receiveMethod === 'DELIVERY' && ['PENDING', 'PREPARING'].includes(order.orderStatus) && <p className="order-preparing-note" role="status">Đơn hàng đang được cửa hàng chuẩn bị.</p>}
        <article className="order-detail-section"><h2>{order.receiveMethod === 'PICKUP' ? <StoreIcon size={18} /> : <MapPin size={18} />}{order.receiveMethod === 'PICKUP' ? 'Thông tin nhận tại cửa hàng' : 'Thông tin giao hàng'}</h2>
          {order.receiveMethod === 'PICKUP' ? <><p><strong>{store?.name ?? 'Cửa hàng Muadee'}</strong></p><p>{store?.address ?? 'Đang cập nhật địa chỉ cửa hàng'}</p><p>Thời gian nhận: {order.pickupTime || 'Đang cập nhật'}</p>{order.orderStatus === 'READY_FOR_PICKUP' && <p className="pickup-ready-note" role="status">Đơn hàng đã sẵn sàng nhận tại cửa hàng.</p>}</>
            : <><p><strong>{order.recipientName || 'Người nhận'}</strong>{order.recipientPhone && ` · ${order.recipientPhone}`}</p><p>{order.shippingAddress || 'Địa chỉ giao hàng đang cập nhật'}</p></>}
        </article>
        <article className="order-detail-section order-products-section"><h2>Sản phẩm</h2>
          {order.items?.length ? order.items.map((item) => {
            const actualQuantity = item.actualWeight ?? item.quantity;
            const difference = item.actualWeight === undefined ? 0 : item.price * (item.actualWeight - item.quantity);
            return <div className="order-product-line" key={item.itemId}>
              <ProductImage src={item.image} alt={item.productName} />
              <div className="order-product-description"><strong>{item.productName}</strong>{item.unit === 'kg' && item.actualWeight !== undefined ? <><span>Đơn giá: {formatMoney(item.price)}/kg · Số lượng: {item.quantity}</span><small>Khối lượng ước tính: {weight(item.quantity)} → Khối lượng thực tế: {weight(item.actualWeight)}</small>{difference !== 0 && <small className={difference > 0 ? 'order-price-difference' : ''}>Chênh lệch khối lượng: {difference > 0 ? '+' : '−'}{formatMoney(Math.abs(difference))}</small>}</> : <span>{formatMoney(item.price)} × {item.quantity} {item.unit}</span>}</div>
              <strong className="order-product-total">{formatMoney(item.price * actualQuantity)}</strong>
            </div>;
          }) : <p>Chi tiết sản phẩm chưa được cập nhật.</p>}
        </article>
          <article className="order-detail-section"><h2>Thanh toán</h2>
            <dl className="order-payment-facts"><div><dt>Phương thức</dt><dd>{methodLabel(paymentMethod)}</dd></div><div><dt>Trạng thái</dt><dd role="status" aria-live="polite">{paymentLabel(order.paymentStatus ?? payments[0]?.paymentStatus)}</dd></div><div><dt>Mã giao dịch</dt><dd>{order.transactionId || payments.find((payment) => payment.transactionId)?.transactionId || 'Chưa có'}</dd></div><div><dt>Thời điểm thanh toán</dt><dd>{formatDate(order.paidAt || payments.find((payment) => payment.paidAt)?.paidAt)}</dd></div></dl>
          <h3 className="payment-history-title">Các lần thanh toán</h3>
          {paymentsError ? <div className="order-inline-error" role="alert"><span>Không tải được lịch sử thanh toán.</span><button type="button" onClick={() => void loadPayments()}><RotateCw size={14} />Thử lại</button></div> : payments.length ? <ul className="order-payment-history">{payments.map((payment) => <li key={payment.paymentId}><span>{methodLabel(payment.paymentMethod)} · {paymentLabel(payment.paymentStatus)}</span><strong>{formatMoney(payment.amount ?? order.totalAmount)}</strong><small>{payment.transactionId || payment.paymentId} · {formatDate(payment.paidAt || payment.createdAt)}</small></li>)}</ul> : <p>Chưa có giao dịch thanh toán.</p>}
        </article>
      </section>
      <aside className="order-detail-summary"><h2>Tóm tắt đơn hàng</h2>
        <p><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></p>
        <p><span>Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}</span><strong>−{formatMoney(order.discountAmount ?? 0)}</strong></p>
        <p><span>Phí vận chuyển</span><strong>{order.shippingFee ? formatMoney(order.shippingFee) : 'Miễn phí'}</strong></p>
        <div className="checkout-total"><span>Tổng cộng</span><strong>{formatMoney(order.totalAmount)}</strong></div>
        {order.orderStatus === 'PENDING' && <>
          <button type="button" className="order-action-edit" onClick={() => setDialog('edit')}>Sửa thông tin nhận hàng</button>
          {paymentMethod && ['TRANSFER', 'CARD'].includes(paymentMethod) && !paymentSucceeded && <Link className="order-action-pay" to={`/payment/${order.orderId}`}>Thanh toán lại</Link>}
          <button type="button" className="order-action-cancel" onClick={() => setDialog('cancel')}>Hủy đơn</button>
        </>}
        {preparationOngoing && <><p className="order-support-note">Đơn đang được chuẩn bị, vui lòng liên hệ CSKH nếu cần hỗ trợ.</p><button type="button" className="order-action-support" onClick={() => window.dispatchEvent(new Event('muadee:open-chat'))}>Mở trò chuyện với CSKH</button></>}
        {delivered && <><button type="button" className="order-action-return" onClick={() => setDialog('return')}>Yêu cầu trả hàng</button><Link className="order-action-review" to="/profile/reviews?tab=pending">Đánh giá sản phẩm</Link></>}
      </aside>
    </div>
    <CancelOrderDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} onConfirm={(reason) => void cancel(reason)} busy={busy} paid={paymentSucceeded} />
    <ReturnOrderDialog open={dialog === 'return'} onClose={() => setDialog(null)} onConfirm={(reason, description) => void requestReturn(reason, description)} busy={busy} />
    <EditShippingInfoDialog open={dialog === 'edit'} onClose={() => setDialog(null)} onConfirm={(value) => void updateShippingInfo(value)} busy={busy} receiveMethod={order.receiveMethod} initialValue={{ recipientName: order.recipientName ?? '', recipientPhone: order.recipientPhone ?? '', shippingAddress: order.shippingAddress ?? '', pickupTime: order.pickupTime ?? '', pickupNote: order.pickupNote ?? '' }} />
  </div>;
}
