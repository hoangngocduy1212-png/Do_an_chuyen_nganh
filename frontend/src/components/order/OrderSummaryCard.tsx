import { Link } from 'react-router-dom';
import { ArrowRight, LoaderCircle, RotateCw, ShoppingBag } from 'lucide-react';
import type { CustomerOrder } from '../../types/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { formatMoney } from '../../utils/money';
import type { CartResponse } from '../../api/cart';
import { useCheckout } from '../../store/checkoutStore';
import { ProductImage } from '../product/ProductImage';

export function OrderSummaryCard({ order, cart, shippingFee = 0, points = 0, onBuyAgain, onRetryPayment, busy = false }: { order?: CustomerOrder; cart?: CartResponse; shippingFee?: number; points?: number; onBuyAgain?: () => void; onRetryPayment?: () => void; busy?: boolean }) {
  const checkout = useCheckout();
  if (!order) {
    const subtotal = cart?.items.reduce((sum, item) => sum + (item.product.salePrice ?? item.product.price) * item.quantity, 0) ?? 0;
    const total = Math.max(0, subtotal - checkout.discountAmount) + shippingFee;
    return <aside className="checkout-summary"><h2>Tóm tắt đơn hàng</h2>{cart?.items.map((item) => <div className="checkout-product" key={item.itemId}><span>{item.product.productName} × {item.quantity} {item.product.unit}</span><strong>{formatMoney((item.product.salePrice ?? item.product.price) * item.quantity)}</strong></div>)}<div className="checkout-total"><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>{checkout.discountAmount > 0 && <div className="checkout-total"><span>Giảm giá</span><strong>-{formatMoney(checkout.discountAmount)}</strong></div>}<div className="checkout-total"><span>Phí vận chuyển</span><strong>{shippingFee ? formatMoney(shippingFee) : 'Miễn phí'}</strong></div><div className="checkout-total checkout-grand-total"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></div><p className="checkout-points">Bạn dự kiến nhận <strong>{points.toLocaleString('vi-VN')} điểm</strong> sau khi đơn hàng giao thành công.</p></aside>;
  }
  return <article className="order-summary-card">
    <header className="order-summary-header"><div><span className="order-code">Mã đơn {order.orderCode}</span><time>{new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div><OrderStatusBadge status={order.orderStatus} pickup={order.receiveMethod === 'PICKUP'} /></header>
    <p className="order-receive-method">{order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao tận nơi'}</p>
    {!!order.items?.length && <div className="order-summary-products">{order.items.slice(0, 2).map((item) => <div key={item.itemId} className="order-summary-product"><ProductImage src={item.image} alt={item.productName} /><span>{item.productName}</span></div>)}{order.items.length > 2 && <span className="order-other-items">+{order.items.length - 2} sản phẩm khác</span>}</div>}
    <footer className="order-summary-footer"><strong>{formatMoney(order.totalAmount)}</strong><div><Link to={`/orders/${order.orderId}`}>Xem chi tiết <ArrowRight size={15} /></Link>{onBuyAgain && <button type="button" disabled={busy} aria-busy={busy} onClick={onBuyAgain}>{busy ? <LoaderCircle className="button-spinner" size={14} /> : <ShoppingBag size={14} />}{busy ? 'Đang thêm...' : 'Mua lại'}</button>}{onRetryPayment && <button type="button" disabled={busy} onClick={onRetryPayment}><RotateCw size={14} />Thanh toán lại</button>}</div></footer>
  </article>;
}