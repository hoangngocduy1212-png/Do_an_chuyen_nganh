import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../../api/client';
import type { AdminOrderRecord } from '../../../api/orders';
import { staffApi, type IssueType, type Paged } from '../../../api/staff';
import type { OrderStatus } from '../../../types/order';
import { currency, formatDate, Heading, Pager } from '../shared';

const LIMIT = 20;
const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Chờ xử lý',
  PREPARING: 'Đang chuẩn bị',
  SHIPPING: 'Đang giao',
  READY_FOR_PICKUP: 'Chờ nhận tại cửa hàng',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  RETURNING: 'Đang trả hàng',
  RETURNED: 'Đã trả hàng',
};
const issueLabels: Record<IssueType, string> = { OUT_OF_STOCK: 'Hết hàng', INVALID_INFORMATION: 'Sai thông tin', OTHER: 'Khác' };

function nextStatus(order: AdminOrderRecord): { value: string; label: string } | null {
  switch (order.orderStatus) {
    case 'PREPARING':
      return order.receiveMethod === 'PICKUP' ? { value: 'READY_FOR_PICKUP', label: 'Sẵn sàng nhận tại cửa hàng' } : { value: 'SHIPPING', label: 'Bắt đầu giao hàng' };
    case 'SHIPPING':
    case 'READY_FOR_PICKUP':
      return { value: 'DELIVERED', label: 'Đã giao / đã nhận hàng' };
    case 'RETURNING':
      return { value: 'RETURNED', label: 'Xác nhận đã nhận hàng trả' };
    default:
      return null;
  }
}

function OrderDetail({ orderId, onChanged, onClose }: { orderId: string; onChanged: () => void; onClose: () => void }) {
  const [order, setOrder] = useState<AdminOrderRecord | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [issueType, setIssueType] = useState<IssueType>('OUT_OF_STOCK');
  const [issueDetail, setIssueDetail] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder(await staffApi.order(orderId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="staff-panel">{error ? <p className="staff-error">{error}</p> : 'Đang tải đơn hàng...'}</div>;
  const next = nextStatus(order);

  return (
    <div className="staff-panel">
      <div className="staff-toolbar" style={{ justifyContent: 'space-between' }}>
        <h2>Đơn {order.orderCode} · <span className="staff-badge">{statusLabels[order.orderStatus]}</span></h2>
        <button className="staff-btn secondary" type="button" onClick={onClose}>Đóng</button>
      </div>
      {error && <p className="staff-error" role="alert">{error}</p>}
      {notice && <p className="staff-notice">{notice}</p>}
      <p>
        Người nhận: <b>{order.recipientName ?? '—'}</b> · {order.recipientPhone ?? '—'}<br />
        Hình thức: {order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao tận nơi'}
        {order.shippingAddress ? ` · ${order.shippingAddress}` : ''}<br />
        Thanh toán: {order.paymentMethod ?? '—'} ({order.paymentStatus ?? '—'}) · Tổng: <b>{currency.format(order.totalAmount)}</b><br />
        {order.note && <>Ghi chú: {order.note}</>}
      </p>

      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Khối lượng thực</th></tr></thead>
          <tbody>
            {(order.items ?? []).map((item) => (
              <tr key={item.itemId}>
                <td>{item.productName}</td>
                <td>{item.quantity} {item.unit}</td>
                <td>{currency.format(item.price)}</td>
                <td>
                  {item.actualWeight != null ? `${item.actualWeight} ` : ''}
                  {order.orderStatus === 'PREPARING' && /kg|g/i.test(item.unit) && (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <input type="number" min="0.001" step="0.001" style={{ width: 90 }} aria-label={`Khối lượng thực ${item.productName}`}
                        value={weights[item.itemId] ?? ''} onChange={(event) => setWeights((current) => ({ ...current, [item.itemId]: event.target.value }))} />
                      <button className="staff-btn secondary" type="button" disabled={busy || !Number(weights[item.itemId])}
                        onClick={() => void run(() => staffApi.updateWeight(orderId, item.itemId, Number(weights[item.itemId])), 'Đã cập nhật khối lượng')}>Lưu</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="staff-actions">
        {order.orderStatus === 'PENDING' && <button className="staff-btn" type="button" disabled={busy} onClick={() => void run(() => staffApi.acceptOrder(orderId), 'Đã tiếp nhận đơn')}>Tiếp nhận đơn</button>}
        {next && <button className="staff-btn" type="button" disabled={busy} onClick={() => void run(() => staffApi.updateStatus(orderId, next.value), 'Đã cập nhật trạng thái')}>{next.label}</button>}
        {order.orderStatus === 'PENDING' && (
          <button className="staff-btn danger" type="button" disabled={busy} onClick={() => {
            const reason = window.prompt('Lý do hủy đơn?')?.trim();
            if (reason) void run(() => staffApi.cancelOrder(orderId, reason), 'Đã hủy đơn');
          }}>Hủy đơn</button>
        )}
      </div>

      <form className="staff-form" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => { await staffApi.reportIssue(orderId, issueType, issueDetail.trim()); setIssueDetail(''); }, 'Đã ghi nhận phản ánh');
      }}>
        <h2>Báo vấn đề với đơn</h2>
        <div className="staff-form-grid">
          <label>Loại<select value={issueType} onChange={(event) => setIssueType(event.target.value as IssueType)}>
            {Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Chi tiết<input required maxLength={2000} value={issueDetail} onChange={(event) => setIssueDetail(event.target.value)} /></label>
        </div>
        <div><button className="staff-btn secondary" type="submit" disabled={busy || !issueDetail.trim()}>Gửi phản ánh</button></div>
      </form>
    </div>
  );
}

export default function StaffOrdersPage() {
  const [data, setData] = useState<Paged<AdminOrderRecord>>({ items: [], total: 0, page: 1, limit: LIMIT });
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await staffApi.orders({ orderStatus: status || undefined, page, limit: LIMIT }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, page]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="staff-page">
      <Heading eyebrow="XỬ LÝ ĐƠN" title="Đơn hàng của cửa hàng" />
      <div className="staff-toolbar">
        <select aria-label="Lọc trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as OrderStatus | ''); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="staff-icon-btn" type="button" aria-label="Tải lại" title="Tải lại" onClick={() => void load()}><RefreshCw size={16} /></button>
      </div>
      {error && <p className="staff-error" role="alert">{error}</p>}
      {selected && <OrderDetail key={selected} orderId={selected} onChanged={() => void load()} onClose={() => setSelected(null)} />}
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Mã đơn</th><th>Người nhận</th><th>Hình thức</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="staff-state">Đang tải...</td></tr>
              : data.items.length === 0 ? <tr><td colSpan={6} className="staff-state">Không có đơn hàng</td></tr>
              : data.items.map((order) => (
                <tr key={order.orderId} className="staff-row-click" tabIndex={0} onClick={() => setSelected(order.orderId)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(order.orderId); }}>
                  <td><b>{order.orderCode}</b></td>
                  <td>{order.recipientName ?? '—'}<br /><small>{order.recipientPhone}</small></td>
                  <td>{order.receiveMethod === 'PICKUP' ? 'Nhận tại cửa hàng' : 'Giao hàng'}</td>
                  <td>{currency.format(order.totalAmount)}</td>
                  <td><span className={`staff-badge ${order.orderStatus === 'PENDING' ? 'warn' : order.orderStatus === 'CANCELLED' ? 'bad' : ''}`}>{statusLabels[order.orderStatus]}</span></td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} limit={LIMIT} total={data.total} onChange={setPage} />
    </section>
  );
}
