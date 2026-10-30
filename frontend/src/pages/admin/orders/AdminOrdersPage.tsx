import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, MapPin, Package, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../../api/client';
import { ordersApi, type AdminOrderPage, type AdminOrderRecord } from '../../../api/orders';
import type { OrderStatus } from '../../../types/order';
import { storesApi, type StoreManagementRecord } from '../../../api/stores';
import './AdminOrdersPage.css';

const PAGE_LIMIT = 20;
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const orderStatuses: Array<{ value: OrderStatus; label: string }> = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'PREPARING', label: 'Đang chuẩn bị' },
  { value: 'SHIPPING', label: 'Đang giao' },
  { value: 'READY_FOR_PICKUP', label: 'Chờ nhận tại cửa hàng' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'RETURNING', label: 'Đang trả hàng' },
  { value: 'RETURNED', label: 'Đã trả hàng' },
];
const statusLabel = new Map(orderStatuses.map((status) => [status.value, status.label]));
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function storeLabel(storeId: string | undefined, stores: StoreManagementRecord[]): string {
  return storeId ? stores.find((store) => store._id === storeId)?.storeName ?? storeId : '—';
}

function OrderList({ onSelectOrder }: { onSelectOrder: (id: string) => void }) {
  const [pageData, setPageData] = useState<AdminOrderPage>({ items: [], total: 0, page: 1, limit: PAGE_LIMIT });
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [storeId, setStoreId] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    storesApi.adminList().then((items) => { if (active) setStores(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function loadOrders() {
    setLoading(true);
    setLoadError('');
    try {
      setPageData(await ordersApi.adminList({ storeId: storeId || undefined, orderStatus: orderStatus || undefined, page, limit: PAGE_LIMIT }));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadOrders(); }, [storeId, orderStatus, page]);

  const filteredOrders = useMemo(() => pageData.items.filter((order) => `${order.orderCode} ${order.recipientName ?? ''} ${order.recipientPhone ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))), [pageData.items, search]);
  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_LIMIT));

  return (
    <section className="admin-orders">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">ĐƠN HÀNG TOÀN HỆ THỐNG</span><h1>Đơn hàng</h1></div><span className="orders-total-count">{pageData.total.toLocaleString('vi-VN')} đơn</span></div>
      <div className="orders-toolbar">
        <div className="orders-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm đơn hàng" placeholder="Tìm mã đơn, khách hàng, số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label><span>Trạng thái</span><select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value as OrderStatus | ''); setPage(1); }}><option value="">Tất cả trạng thái</option>{orderStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label><span>Cửa hàng</span><select value={storeId} onChange={(event) => { setStoreId(event.target.value); setPage(1); }}><option value="">Tất cả cửa hàng</option>{stores.map((store) => <option value={store._id} key={store._id}>{store.storeName}</option>)}</select></label>
      </div>
      <div className="orders-table-wrap"><table className="orders-table">
        <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Cửa hàng</th><th>Tổng tiền</th><th>Hình thức nhận</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead>
        <tbody>
          {loading && <tr><td className="orders-state" colSpan={8}><span className="admin-loading-mark" />Đang tải đơn hàng...</td></tr>}
          {!loading && loadError && <tr><td className="orders-state orders-state-error" colSpan={8}><strong>Không tải được đơn hàng</strong><span>{loadError}</span><button type="button" onClick={() => void loadOrders()}>Thử lại</button></td></tr>}
          {!loading && !loadError && filteredOrders.length === 0 && <tr><td className="orders-state" colSpan={8}><span className="orders-empty-icon"><ClipboardList size={21} /></span><strong>{search || orderStatus || storeId ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng nào'}</strong><span>{search || orderStatus || storeId ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Đơn hàng mới sẽ xuất hiện tại đây.'}</span></td></tr>}
          {!loading && !loadError && filteredOrders.map((order) => <tr key={order.orderId} className="orders-data-row" onClick={() => onSelectOrder(order.orderId)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onSelectOrder(order.orderId); }}>
            <td><strong className="orders-code">{order.orderCode}</strong></td>
            <td><span className="orders-customer">{order.recipientName || 'Khách hàng'}</span><small className="orders-customer-phone">{order.recipientPhone ?? ''}</small></td>
            <td className="orders-store-name">{storeLabel(order.storeId, stores)}</td>
            <td className="orders-amount">{currency.format(order.totalAmount)}</td>
            <td>{order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao hàng'}</td>
            <td><span className={`orders-status status-${order.orderStatus.toLowerCase()}`}>{statusLabel.get(order.orderStatus) ?? order.orderStatus}</span></td>
            <td className="orders-date">{formatDate(order.createdAt)}</td>
            <td><ChevronRight size={16} className="orders-row-arrow" /></td>
          </tr>)}
        </tbody>
      </table></div>
      {!loading && !loadError && pageData.total > PAGE_LIMIT && <nav className="orders-pagination" aria-label="Phân trang đơn hàng"><span>Trang {page} / {totalPages}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Trước</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Tiếp</button></div></nav>}
    </section>
  );
}

function OrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<AdminOrderRecord | null>(null);
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([ordersApi.adminGet(orderId), storesApi.adminList()]).then(([orderData, storeData]) => {
      if (!active) return;
      setOrder(orderData);
      setStores(storeData);
    }).catch((error: unknown) => { if (active) setLoadError(errorMessage(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  if (loading) return <div className="orders-detail-state"><span className="admin-loading-mark" />Đang tải chi tiết đơn...</div>;
  if (loadError || !order) return <section className="orders-detail-error"><button className="orders-back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Quay lại danh sách</button><div className="admin-inline-error" role="alert">{loadError || 'Không tìm thấy đơn hàng'}</div></section>;

  return (
    <section className="admin-order-detail">
      <button className="orders-back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Danh sách đơn hàng</button>
      <div className="orders-detail-heading"><div><span className="admin-eyebrow">CHI TIẾT ĐƠN HÀNG</span><h1>{order.orderCode}</h1><span className={`orders-status status-${order.orderStatus.toLowerCase()}`}>{statusLabel.get(order.orderStatus) ?? order.orderStatus}</span></div><time>{formatDate(order.createdAt)}</time></div>
      <div className="orders-detail-grid">
        <section className="orders-detail-section"><h2>Thông tin nhận hàng</h2><dl><div><dt>Khách hàng</dt><dd>{order.recipientName || '—'}</dd></div><div><dt>Điện thoại</dt><dd>{order.recipientPhone || '—'}</dd></div><div><dt>Hình thức nhận</dt><dd>{order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao hàng'}</dd></div><div><dt>Cửa hàng</dt><dd>{storeLabel(order.storeId, stores)}</dd></div>{order.shippingAddress && <div><dt>Địa chỉ</dt><dd><MapPin size={14} />{order.shippingAddress}</dd></div>}{order.pickupTime && <div><dt>Thời gian nhận</dt><dd>{order.pickupTime}</dd></div>}{order.note && <div><dt>Ghi chú</dt><dd>{order.note}</dd></div>}</dl></section>
        <section className="orders-detail-section"><h2>Thanh toán</h2><dl><div><dt>Phương thức</dt><dd>{order.paymentMethod ?? '—'}</dd></div><div><dt>Trạng thái thanh toán</dt><dd>{order.paymentStatus ?? '—'}</dd></div><div><dt>Tạm tính</dt><dd>{currency.format(order.subtotal ?? order.totalAmount)}</dd></div><div><dt>Giảm giá</dt><dd>−{currency.format(order.discountAmount ?? 0)}</dd></div><div><dt>Phí giao hàng</dt><dd>{currency.format(order.shippingFee ?? 0)}</dd></div><div className="orders-grand-total"><dt>Tổng thanh toán</dt><dd>{currency.format(order.totalAmount)}</dd></div></dl></section>
      </div>
      <section className="orders-detail-section orders-items-section"><h2><Package size={17} /> Sản phẩm trong đơn <span>{order.items?.length ?? 0}</span></h2>{order.items?.length ? <div className="orders-items-list">{order.items.map((item) => <div className="orders-item-row" key={item.itemId}><span className="orders-item-name">{item.productName}<small>{item.quantity} {item.unit}{item.actualWeight ? ` · cân thực tế ${item.actualWeight} ${item.unit}` : ''}</small></span><strong>{currency.format(item.price * (item.actualWeight ?? item.quantity))}</strong></div>)}</div> : <p className="orders-no-items">Không có chi tiết sản phẩm.</p>}</section>
      {order.statusHistory?.length ? <section className="orders-detail-section orders-history-section"><h2>Lịch sử trạng thái</h2><ol>{order.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.at}-${index}`}><i /><span><strong>{statusLabel.get(entry.status) ?? entry.status}</strong><small>{formatDate(entry.at)}</small></span></li>)}</ol></section> : null}
      <div className="orders-read-only-note">Thông tin đơn hàng ở màn hình này chỉ xem, không thể chỉnh sửa trạng thái.</div>
    </section>
  );
}

export default function AdminOrdersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return id
    ? <OrderDetail key={id} orderId={id} onBack={() => navigate('/admin/orders')} />
    : <OrderList onSelectOrder={(orderId) => navigate(`/admin/orders/${encodeURIComponent(orderId)}`)} />;
}
