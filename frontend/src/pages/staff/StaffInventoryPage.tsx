import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import type { InventoryRecord } from '../../api/inventory';
import { productsApi } from '../../api/products';
import { staffApi } from '../../api/staff';
import { Heading } from './shared';

const qty = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

export default function StaffInventoryPage() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    productsApi.adminListPage({ limit: 50 })
      .then((page) => setNames(new Map(page.items.map((product) => [product.productId, product.productName]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    staffApi.inventory(lowOnly)
      .then((rows) => { if (active) setRecords(rows); })
      .catch((err: unknown) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lowOnly]);

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return records.filter((record) => `${names.get(record.productId) ?? ''} ${record.productId}`.toLocaleLowerCase('vi').includes(term));
  }, [records, names, search]);

  return (
    <section className="staff-page">
      <Heading eyebrow="KHO CỬA HÀNG" title="Tồn kho" />
      <div className="staff-toolbar">
        <input aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="staff-check"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> Chỉ hàng sắp hết</label>
      </div>
      {error && <p className="staff-error" role="alert">{error}</p>}
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Sản phẩm</th><th>Tồn</th><th>Đang giữ</th><th>Khả dụng</th><th>Ngưỡng</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="staff-state">Đang tải...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="staff-state">Không có dữ liệu tồn kho</td></tr>
              : rows.map((record) => {
                const available = record.quantity - record.reservedQuantity;
                return (
                  <tr key={`${record.storeId}-${record.productId}`}>
                    <td>{names.get(record.productId) ?? record.productId}</td>
                    <td>{qty.format(record.quantity)}</td>
                    <td>{qty.format(record.reservedQuantity)}</td>
                    <td><span className={`staff-badge ${available <= record.lowStockThreshold ? 'warn' : 'ok'}`}>{qty.format(available)}</span></td>
                    <td>{qty.format(record.lowStockThreshold)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
