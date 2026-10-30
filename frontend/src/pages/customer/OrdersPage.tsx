import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, PackageSearch, RotateCw } from 'lucide-react';
import { cartApi } from '../../api/cart';
import { ordersApi } from '../../api/orders';
import { productsApi } from '../../api/products';
import { OrderSummaryCard } from '../../components/order/OrderSummaryCard';
import type { CustomerOrder, OrderStatus } from '../../types/order';
import { cartStore } from '../../store/cartStore';
import { checkoutStore } from '../../store/checkoutStore';
import { useStoreSelection } from '../../store/storeSelectionStore';

const filters: Array<{ label: string; statuses?: OrderStatus[] }> = [
  { label: 'Tất cả' },
  { label: 'Chờ xử lý', statuses: ['PENDING'] },
  { label: 'Đang chuẩn bị', statuses: ['PREPARING'] },
  { label: 'Đang giao / Sẵn sàng nhận', statuses: ['SHIPPING', 'READY_FOR_PICKUP'] },
  { label: 'Đã giao', statuses: ['DELIVERED'] },
  { label: 'Đã hủy', statuses: ['CANCELLED'] },
  { label: 'Trả hàng', statuses: ['RETURNING', 'RETURNED'] },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { storeId } = useStoreSelection();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState(0);
  const [visibleCount, setVisibleCount] = useState(10);
  const [busyOrderId, setBusyOrderId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setOrders(await ordersApi.mine(100)); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const statuses = filters[activeFilter].statuses;
    return statuses ? orders.filter((order) => statuses.includes(order.orderStatus)) : orders;
  }, [activeFilter, orders]);

  async function buyAgain(order: CustomerOrder) {
    if (!order.items?.length || busyOrderId) {
      if (!order.items?.length) window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đơn hàng chưa có thông tin sản phẩm để mua lại.' }));
      return;
    }
    setBusyOrderId(order.orderId);
    try {
      const products = await productsApi.list({ storeId, inStock: true });
      const available = new Map(products.filter((product) => product.status === 'ACTIVE' && product.stock > 0).map((product) => [product.productId, product]));
      let added = 0;
      let skipped = 0;
      for (const item of order.items) {
        const product = available.get(item.productId);
        if (!product) { skipped += 1; continue; }
        const quantity = Math.min(item.quantity, product.stock);
        try {
          await cartApi.add(product.productId, quantity, storeId);
          cartStore.add(product, quantity);
          added += 1;
        } catch { skipped += 1; }
      }
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: added ? `Đã thêm ${added} sản phẩm còn hàng vào giỏ${skipped ? ` · Bỏ qua ${skipped} sản phẩm` : ''}` : 'Các sản phẩm trong đơn đã hết hàng hoặc chưa thể thêm vào giỏ.' }));
      if (added) navigate('/cart');
    } catch {
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Không thể mua lại đơn hàng. Vui lòng thử lại.' }));
    } finally { setBusyOrderId(undefined); }
  }

  return <div className="orders-page">
    <header className="listing-heading"><span className="section-eyebrow">ĐƠN HÀNG CỦA BẠN</span><h2>Đơn hàng của tôi</h2><p>Theo dõi tình trạng và lịch sử mua sắm tại Muadee.</p></header>
    {!loading && !error && <div className="orders-filter-list" role="tablist" aria-label="Lọc đơn hàng">
      {filters.map((filter, index) => <button key={filter.label} type="button" role="tab" aria-selected={activeFilter === index} className={activeFilter === index ? 'selected' : ''} onClick={() => { setActiveFilter(index); setVisibleCount(10); }}>{filter.label}</button>)}
    </div>}
    {loading ? <div className="cart-loading" aria-label="Đang tải đơn hàng"><i /><i /><i /></div> : error ? <div className="listing-message" role="alert"><strong>Không tải được dữ liệu</strong><p>Vui lòng thử lại để xem đơn hàng của bạn.</p><button type="button" onClick={() => void loadOrders()}><RotateCw size={15} /> Thử lại</button></div> : filteredOrders.length ? <>
      <section className="order-history-list" aria-label="Danh sách đơn hàng" aria-live="polite">{filteredOrders.slice(0, visibleCount).map((order) => {
        const method = order.paymentMethod ?? checkoutStore.getOrderPaymentMethod(order.orderId);
        return <OrderSummaryCard key={order.orderId} order={order} busy={busyOrderId === order.orderId} onBuyAgain={() => void buyAgain(order)} onRetryPayment={order.orderStatus === 'PENDING' && (method === 'TRANSFER' || method === 'CARD') && order.paymentStatus !== 'SUCCESS' ? () => navigate(`/payment/${order.orderId}`) : undefined} />;
      })}</section>
      {filteredOrders.length > visibleCount && <button className="orders-load-more" type="button" onClick={() => setVisibleCount((count) => count + 10)}>Xem thêm đơn hàng</button>}
    </> : <div className="orders-empty"><PackageSearch size={30} /><h2>{orders.length ? 'Không có đơn hàng phù hợp' : 'Bạn chưa có đơn hàng nào'}</h2><p>{orders.length ? 'Thử chọn một trạng thái khác để xem đơn hàng.' : 'Những đơn hàng đã đặt sẽ hiển thị tại đây.'}</p>{!orders.length && <Link to="/products">Khám phá sản phẩm <ArrowRight size={16} /></Link>}</div>}
  </div>;
}
