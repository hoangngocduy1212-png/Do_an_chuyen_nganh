import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, PackageCheck, RefreshCw, TrendingUp } from 'lucide-react';
import { errorMessage } from '../../../api/client';
import { forecastsApi, type ForecastAlert, type ForecastRow } from '../../../api/forecasts';
import { storesApi, type StoreManagementRecord } from '../../../api/stores';
import '../inventory/AdminInventoryPage.css';
import './AdminForecastPage.css';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const ALERT_LABEL: Record<ForecastAlert, string> = { SHORTAGE: 'Sắp thiếu hàng', OVERSTOCK: 'Tồn dư', NORMAL: 'Bình thường' };

export default function AdminForecastPage() {
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [storeId, setStoreId] = useState('');
  const [periodDays, setPeriodDays] = useState(7);
  const [filter, setFilter] = useState<ForecastAlert | 'ALL'>('ALL');
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    storesApi.adminList().then((list) => {
      setStores(list);
      if (list[0]) setStoreId(list[0]._id);
    }).catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function load() {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      setRows(await forecastsApi.run(storeId, periodDays));
    } catch (err) {
      setRows([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [storeId, periodDays]);

  const counts = useMemo(() => ({
    SHORTAGE: rows.filter((r) => r.alertType === 'SHORTAGE').length,
    OVERSTOCK: rows.filter((r) => r.alertType === 'OVERSTOCK').length,
    NORMAL: rows.filter((r) => r.alertType === 'NORMAL').length,
  }), [rows]);
  const visible = rows.filter((r) => filter === 'ALL' || r.alertType === filter);

  return (
    <section className="admin-inventory admin-forecast">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">DỰ BÁO BẰNG AI</span><h1>Dự báo nhu cầu</h1></div>
      </div>

      <div className="inventory-toolbar">
        <label className="inventory-store-filter"><span>Cửa hàng</span>
          <select value={storeId} onChange={(event) => setStoreId(event.target.value)}>{stores.map((store) => <option value={store._id} key={store._id}>{store.storeName}</option>)}</select>
        </label>
        <label className="inventory-store-filter"><span>Dự báo cho</span>
          <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>{[3, 7, 14, 30].map((d) => <option value={d} key={d}>{d} ngày tới</option>)}</select>
        </label>
        <button className="inventory-refresh" type="button" title="Chạy lại dự báo" aria-label="Chạy lại dự báo" onClick={() => void load()} disabled={loading || !storeId}><RefreshCw size={16} /></button>
      </div>

      <div className="forecast-cards">
        <button type="button" className={`forecast-card shortage ${filter === 'SHORTAGE' ? 'active' : ''}`} onClick={() => setFilter(filter === 'SHORTAGE' ? 'ALL' : 'SHORTAGE')}><AlertTriangle size={18} /><strong>{counts.SHORTAGE}</strong><span>Sắp thiếu hàng</span></button>
        <button type="button" className={`forecast-card overstock ${filter === 'OVERSTOCK' ? 'active' : ''}`} onClick={() => setFilter(filter === 'OVERSTOCK' ? 'ALL' : 'OVERSTOCK')}><TrendingUp size={18} /><strong>{counts.OVERSTOCK}</strong><span>Tồn dư</span></button>
        <button type="button" className={`forecast-card normal ${filter === 'NORMAL' ? 'active' : ''}`} onClick={() => setFilter(filter === 'NORMAL' ? 'ALL' : 'NORMAL')}><PackageCheck size={18} /><strong>{counts.NORMAL}</strong><span>Bình thường</span></button>
      </div>

      {error && <div className="admin-inline-error" role="alert">{error}</div>}
      <div className="inventory-summary"><span>{visible.length} sản phẩm</span><small>Dự báo = nhu cầu trung bình theo ngày (56 ngày gần nhất, làm trơn mũ) × số ngày. Gợi ý nhập = nhu cầu × 1,2 − tồn khả dụng.</small></div>

      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead><tr><th>Sản phẩm</th><th>Tồn khả dụng</th><th>Nhu cầu dự báo</th><th>Trạng thái</th><th>Gợi ý nhập thêm</th></tr></thead>
          <tbody>
            {loading && <tr><td className="inventory-state" colSpan={5}><span className="admin-loading-mark" />Đang chạy dự báo...</td></tr>}
            {!loading && visible.length === 0 && <tr><td className="inventory-state" colSpan={5}><strong>{error ? 'Chưa có dữ liệu dự báo' : 'Không có sản phẩm phù hợp'}</strong></td></tr>}
            {!loading && visible.map((row) => (
              <tr key={row.productId}>
                <td><div className="inventory-product-cell"><strong>{row.productName}</strong><small>{row.productId}</small></div></td>
                <td>{number.format(row.currentStock)} {row.unit}</td>
                <td>{number.format(row.predictedQuantity)} {row.unit}</td>
                <td><span className={`forecast-badge ${row.alertType.toLowerCase()}`}>{ALERT_LABEL[row.alertType]}</span></td>
                <td>{row.suggestedQuantity > 0 ? <strong>{number.format(row.suggestedQuantity)} {row.unit}</strong> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
