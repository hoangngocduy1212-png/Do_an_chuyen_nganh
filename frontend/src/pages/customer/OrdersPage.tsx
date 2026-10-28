import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageSearch } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { OrderSummaryCard } from '../../components/order/OrderSummaryCard';
import type { CustomerOrder } from '../../types/order';

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { ordersApi.mine().then(setOrders).catch(() => setError(true)).finally(() => setLoading(false)); }, []);
  return <div className="customer-shell orders-page"><Breadcrumb items={[{ label: 'Đơn hàng của tôi' }]} /><header className="listing-heading"><span className="section-eyebrow">ĐƠN HÀNG CỦA BẠN</span><h1>Đơn hàng của tôi</h1><p>Theo dõi tình trạng và lịch sử mua sắm tại Muadee.</p></header>{loading ? <div className="cart-loading"><i /><i /></div> : error ? <div className="listing-message" role="alert"><strong>Không tải được đơn hàng</strong><p>Vui lòng thử lại sau.</p><button type="button" onClick={() => window.location.reload()}>Thử lại</button></div> : orders.length ? <section className="order-history-list" aria-label="Danh sách đơn hàng">{orders.map((order) => <OrderSummaryCard key={order.orderId} order={order} />)}</section> : <div className="orders-empty"><PackageSearch size={30} /><h2>Bạn chưa có đơn hàng nào</h2><p>Những đơn hàng đã đặt sẽ hiển thị tại đây.</p><Link to="/products">Khám phá sản phẩm <ArrowRight size={16} /></Link></div>}</div>;
}