import { useEffect, useState } from 'react';
import { ArrowUpRight, Boxes, ClipboardList, FolderTree, MapPinned, PackageSearch, RefreshCw, TicketPercent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminDashboardApi, type AdminDashboardOverview } from '../../../api/adminDashboard';
import { errorMessage } from '../../../api/client';
import './AdminDashboard.css';

const sections = [
  { label: 'Sản phẩm', description: 'Thông tin và trạng thái kinh doanh', path: '/admin/products', icon: PackageSearch, tone: 'green' },
  { label: 'Danh mục', description: 'Phân nhóm sản phẩm', path: '/admin/categories', icon: FolderTree, tone: 'amber' },
  { label: 'Cửa hàng', description: 'Địa điểm và hoạt động cửa hàng', path: '/admin/stores', icon: MapPinned, tone: 'blue' },
  { label: 'Voucher', description: 'Mã ưu đãi và thời hạn áp dụng', path: '/admin/vouchers', icon: TicketPercent, tone: 'rose' },
  { label: 'Tồn kho', description: 'Nhập, xuất và theo dõi tồn', path: '/admin/inventory', icon: Boxes, tone: 'teal' },
  { label: 'Đơn hàng', description: 'Tra cứu đơn hàng toàn hệ thống', path: '/admin/orders', icon: ClipboardList, tone: 'slate' },
];
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('vi-VN');
const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang giao', READY_FOR_PICKUP: 'Chờ nhận',
  DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy', RETURNING: 'Đang trả', RETURNED: 'Đã trả',
};
function monthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(year, month - 1, 1));
}

export default function AdminHomePage() {
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function loadOverview() {
    setLoading(true);
    setLoadError('');
    try { setOverview(await adminDashboardApi.overview()); }
    catch (error) { setLoadError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadOverview(); }, []);

  const maxRevenue = Math.max(1, ...(overview?.revenueMonths.map((month) => month.revenue) ?? []));
  const orderStatuses = Object.entries(overview?.ordersByStatus ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <section className="admin-dashboard">
      <div className="admin-page-heading dashboard-heading"><div><span className="admin-eyebrow">MU A DEE / TỔNG QUAN</span><h1>Dashboard</h1></div><button className="dashboard-refresh" type="button" title="Làm mới số liệu" aria-label="Làm mới số liệu" onClick={() => void loadOverview()} disabled={loading}><RefreshCw size={16} /></button></div>
      {loading && <div className="dashboard-state"><span className="admin-loading-mark" />Đang tải số liệu tổng quan...</div>}
      {!loading && loadError && <div className="dashboard-error" role="alert"><strong>Không tải được dashboard</strong><span>{loadError}</span><button type="button" onClick={() => void loadOverview()}>Thử lại</button></div>}
      {!loading && !loadError && overview && <>
        <div className="dashboard-kpis">
          <article className="dashboard-kpi revenue-kpi"><span className="dashboard-kpi-icon"><ArrowUpRight size={17} /></span><small>DOANH THU ĐÃ THANH TOÁN · THÁNG NÀY</small><strong>{currency.format(overview.metrics.paidRevenueThisMonth)}</strong><span className="dashboard-kpi-foot">Tổng payment thành công trong tháng</span></article>
          <article className="dashboard-kpi"><span className="dashboard-kpi-icon amber"><ClipboardList size={17} /></span><small>ĐƠN HÀNG</small><strong>{integer.format(overview.metrics.totalOrders)}</strong><span className="dashboard-kpi-foot"><b>{integer.format(overview.metrics.todayOrders)}</b> đơn hôm nay</span></article>
          <article className="dashboard-kpi"><span className="dashboard-kpi-icon blue"><PackageSearch size={17} /></span><small>SẢN PHẨM ĐANG BÁN</small><strong>{integer.format(overview.metrics.activeProducts)}</strong><span className="dashboard-kpi-foot">{integer.format(overview.metrics.totalProducts)} sản phẩm trong hệ thống</span></article>
          <article className="dashboard-kpi"><span className="dashboard-kpi-icon rose"><Boxes size={17} /></span><small>DÒNG TỒN THẤP</small><strong>{integer.format(overview.metrics.lowStockRows)}</strong><span className="dashboard-kpi-foot">Trong {integer.format(overview.metrics.inventoryRows)} dòng tồn kho</span></article>
        </div>

        {overview.documentCount === 0 && <div className="dashboard-empty"><strong>Chưa có dữ liệu hoạt động.</strong><span>Số liệu tổng quan sẽ hiển thị khi hệ thống có đơn hàng và sản phẩm.</span></div>}

        <div className="dashboard-main-grid">
          <section className="dashboard-panel dashboard-revenue-panel"><header><div><span className="admin-eyebrow">DÒNG TIỀN</span><h2>Doanh thu 6 tháng</h2></div><span className="dashboard-panel-meta">Theo payment thành công</span></header>
            <div className="revenue-chart" role="img" aria-label="Biểu đồ doanh thu 6 tháng gần nhất"><div className="revenue-y-labels"><span>{currency.format(maxRevenue)}</span><span>{currency.format(maxRevenue / 2)}</span><span>0 ₫</span></div><div className="revenue-bars">{overview.revenueMonths.map((month) => <div className="revenue-bar-column" key={month.month}><div className="revenue-bar-track"><div className="revenue-bar" style={{ height: `${Math.max(month.revenue ? 4 : 0, month.revenue / maxRevenue * 100)}%` }} title={`${monthLabel(month.month)}: ${currency.format(month.revenue)}`} /></div><small>{monthLabel(month.month)}</small></div>)}</div></div>
            <div className="revenue-chart-foot"><span><i /> Doanh thu đã thanh toán</span><strong>{integer.format(overview.revenueMonths.reduce((sum, month) => sum + month.payments, 0))} giao dịch</strong></div>
          </section>
          <section className="dashboard-panel dashboard-status-panel"><header><div><span className="admin-eyebrow">ĐƠN HÀNG</span><h2>Trạng thái hiện tại</h2></div><Link to="/admin/orders">Xem đơn hàng <ArrowUpRight size={14} /></Link></header>
            {orderStatuses.length === 0 ? <p className="dashboard-panel-empty">Chưa có đơn hàng.</p> : <div className="dashboard-status-list">{orderStatuses.map(([status, count]) => <div key={status}><span>{statusLabels[status] ?? status}</span><strong>{integer.format(count)}</strong><div><i style={{ width: `${Math.max(3, count / Math.max(1, overview.metrics.totalOrders) * 100)}%` }} /></div></div>)}</div>}
          </section>
        </div>

        <section className="dashboard-shortcuts"><div className="dashboard-shortcuts-heading"><span className="admin-eyebrow">QUẢN LÝ NHANH</span><h2>Khu vực vận hành</h2></div><div className="admin-section-grid">{sections.map(({ label, description, path, icon: Icon, tone }) => <Link className="admin-section-tile" to={path} key={path}><span className={`admin-tile-icon ${tone}`}><Icon size={20} /></span><span className="admin-tile-copy"><strong>{label}</strong><small>{description}</small></span><ArrowUpRight className="admin-tile-arrow" size={16} /></Link>)}</div></section>
        <div className="admin-home-note"><span className="admin-note-rule" /><p>Cập nhật lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(overview.generatedAt))} <strong>·</strong> Số liệu vận hành</p></div>
      </>}
    </section>
  );
}
