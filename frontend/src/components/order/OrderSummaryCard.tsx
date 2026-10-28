import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { CustomerOrder } from '../../types/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { formatMoney } from '../../utils/money';
import type { CartResponse } from '../../api/cart';
import { useCheckout } from '../../store/checkoutStore';

export function OrderSummaryCard({ order, cart, shippingFee = 0, points = 0 }: { order?: CustomerOrder; cart?: CartResponse; shippingFee?: number; points?: number }) {
  const checkout = useCheckout();
  if (!order) {
    const subtotal = cart?.items.reduce((sum, item) => sum + (item.product.salePrice ?? item.product.price) * item.quantity, 0) ?? 0;
    const total = Math.max(0, subtotal - checkout.discountAmount) + shippingFee;
    return <aside className="checkout-summary"><h2>Tóm tắt đơn hàng</h2>{cart?.items.map((item) => <div className="checkout-product" key={item.itemId}><span>{item.product.productName} × {item.quantity} {item.product.unit}</span><strong>{formatMoney((item.product.salePrice ?? item.product.price) * item.quantity)}</strong></div>)}<div className="checkout-total"><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>{checkout.discountAmount > 0 && <div className="checkout-total"><span>Giảm giá</span><strong>-{formatMoney(checkout.discountAmount)}</strong></div>}<div className="checkout-total"><span>Phí vận chuyển</span><strong>{shippingFee ? formatMoney(shippingFee) : 'Miễn phí'}</strong></div><div className="checkout-total checkout-grand-total"><span>Tổng cộng</span><strong>{formatMoney(total)}</strong></div><p className="checkout-points">Bạn dự kiến nhận <strong>{points.toLocaleString('vi-VN')} điểm</strong> sau khi đơn hàng giao thành công.</p></aside>;
  }
  return <article className="order-summary-card"><div><span className="order-code">Mã đơn {order.orderCode}</span><time>{new Date(order.createdAt).toLocaleString('vi-VN')}</time><OrderStatusBadge status={order.orderStatus} /></div><div><strong>{formatMoney(order.totalAmount)}</strong><Link to={`/orders/${order.orderId}`}>Theo dõi đơn <ArrowRight size={15} /></Link></div></article>;
}