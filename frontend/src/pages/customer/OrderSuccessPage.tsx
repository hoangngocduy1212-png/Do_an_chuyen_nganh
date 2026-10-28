import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, PackageCheck } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import type { CustomerOrder } from '../../types/order';
import { OrderStatusBadge } from '../../components/order/OrderStatusBadge';
import { formatMoney } from '../../utils/money';
import { cartApi } from '../../api/cart';
import { cartStore } from '../../store/cartStore';
import { checkoutStore } from '../../store/checkoutStore';
import { paymentsApi } from '../../api/payments';
import { storesApi } from '../../api/stores';
import type { PaymentRequestResult } from '../../types/payment';
import type { StoreLocation } from '../../types/store';

export default function OrderSuccessPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<CustomerOrder>();
  const [payment, setPayment] = useState<PaymentRequestResult | null>(null);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  useEffect(() => {
    ordersApi.get(id).then((value) => {
      setOrder(value);
      if (checkoutStore.getOrderPaymentMethod(id) === 'CASH') setPayment(null);
      else paymentsApi.forOrder(id).then(setPayment).catch(() => setPayment(null));
    }).catch(() => undefined);
    storesApi.list().then(setStores).catch(() => setStores([]));
    cartApi.clear().catch(() => undefined);
    cartStore.clear(); checkoutStore.clearVoucher();
  }, [id]);
  const receiveText = order?.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao tận nơi';
  const paymentMethod = order?.paymentMethod ?? payment?.paymentMethod ?? checkoutStore.getOrderPaymentMethod(id);
  const paymentText = paymentMethod === 'CASH' ? order?.receiveMethod === 'PICKUP' ? 'Thanh toán tại cửa hàng khi nhận hàng' : 'Thanh toán khi nhận hàng' : paymentMethod === 'CARD' ? 'Thẻ ATM/Visa/Mastercard' : 'Chuyển khoản QR';
  const paymentStatus = order?.paymentStatus === 'SUCCESS' || payment?.paymentStatus === 'SUCCESS' ? 'Đã thanh toán' : paymentMethod === 'CASH' ? 'Thanh toán khi nhận hàng' : 'Đang chờ thanh toán';
  const storeName = stores.find((store) => store._id === order?.storeId)?.name ?? order?.storeId ?? 'Cửa hàng đã chọn';
  const receiveLocation = order?.receiveMethod === 'PICKUP' ? `${storeName}${stores.find((store) => store._id === order?.storeId)?.address ? ` · ${stores.find((store) => store._id === order?.storeId)?.address}` : ''}` : order?.shippingAddress;
  const estimate = order?.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt).toLocaleString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : order?.receiveMethod === 'PICKUP' ? order.pickupTime : undefined;
  return <div className="customer-shell order-success-page"><span className="order-success-icon"><Check size={26} /></span><span className="section-eyebrow">MUADEE CẢM ƠN BẠN</span><h1>Đặt hàng thành công!</h1><p>Đơn hàng đã được ghi nhận. Muadee sẽ cập nhật trạng thái khi cửa hàng xác nhận.</p>{order && <section className="success-order-details"><div className="success-order-heading"><PackageCheck size={19} /><strong>Mã đơn {order.orderCode}</strong><OrderStatusBadge status={order.orderStatus} /></div><div><span>Hình thức nhận</span><strong>{receiveText}{estimate ? ` · Dự kiến ${estimate}` : ''}</strong></div><div><span>{order.receiveMethod === 'PICKUP' ? 'Cửa hàng nhận hàng' : 'Địa chỉ giao hàng'}</span><strong>{receiveLocation}</strong></div><div><span>Tổng tiền</span><strong>{formatMoney(order.totalAmount)}</strong></div><div><span>Phương thức thanh toán</span><strong>{paymentText}</strong></div><div><span>Trạng thái thanh toán</span><strong>{paymentStatus}</strong></div></section>}<div><Link to={`/orders/${id}`}>Theo dõi đơn hàng</Link><Link className="secondary-button" to="/products">Tiếp tục mua sắm</Link></div></div>;
}