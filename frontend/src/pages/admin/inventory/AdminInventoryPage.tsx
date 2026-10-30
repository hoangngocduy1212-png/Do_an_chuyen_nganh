import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, PackageSearch, RefreshCw, Search, X } from 'lucide-react';
import { errorMessage } from '../../../api/client';
import { inventoryApi, type InventoryChangeInput, type InventoryRecord } from '../../../api/inventory';
import { productsApi, type AdminProductRecord } from '../../../api/products';
import { storesApi, type StoreManagementRecord } from '../../../api/stores';
import './AdminInventoryPage.css';

const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
type InventoryOperation = 'import' | 'export';

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [operation, setOperation] = useState<InventoryOperation>('import');
  const [form, setForm] = useState<InventoryChangeInput>({ storeId: '', productId: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadInventory(selectedStore = storeId) {
    setLoading(true);
    setLoadError('');
    try {
      setInventory(await inventoryApi.list(selectedStore || undefined));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    storesApi.adminList().then(async (storeRows) => {
      if (!active) return;
      setStores(storeRows);
      if (storeRows[0]) setStoreId(storeRows[0]._id);
      const page = await productsApi.adminListPage({ limit: 50 });
      if (active) setProducts(page.items);
    }).catch((error: unknown) => {
      if (active) setReferenceError(errorMessage(error));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { void loadInventory(storeId); }, [storeId]);

  const productById = useMemo(() => new Map(products.map((product) => [product.productId, product])), [products]);
  const filteredInventory = inventory.filter((record) => {
    const product = productById.get(record.productId);
    return `${product?.productName ?? ''} ${record.productId}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
  });

  function openChange(nextOperation: InventoryOperation, productId = '') {
    setOperation(nextOperation);
    setForm({ storeId, productId, quantity: 1 });
    setFormError('');
    setNotice('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setFormError('');
  }

  async function submitChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...form, quantity: Number(form.quantity) };
    if (!input.storeId || !input.productId || !Number.isFinite(input.quantity) || input.quantity <= 0) {
      setFormError('Chọn cửa hàng, sản phẩm và nhập số lượng lớn hơn 0.');
      return;
    }
    const row = inventory.find((item) => item.storeId === input.storeId && item.productId === input.productId);
    if (operation === 'export' && row && input.quantity > Math.max(0, row.quantity - row.reservedQuantity)) {
      setFormError(`Số lượng xuất vượt tồn khả dụng (${currency.format(Math.max(0, row.quantity - row.reservedQuantity))}).`);
      return;
    }
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      if (operation === 'import') await inventoryApi.importStock(input);
      else await inventoryApi.exportStock(input);
      setFormOpen(false);
      setNotice(operation === 'import' ? 'Nhập kho thành công.' : 'Xuất kho thành công.');
      await loadInventory(input.storeId);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-inventory">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">VẬN HÀNH HÀNG HÓA</span><h1>Tồn kho</h1></div>
        <div className="inventory-header-actions"><button className="inventory-import-button" type="button" onClick={() => openChange('import')} disabled={!stores.length || !products.length}><ArrowDownToLine size={16} /> Nhập kho</button><button className="inventory-export-button" type="button" onClick={() => openChange('export')} disabled={!stores.length || !products.length}><ArrowUpFromLine size={16} /> Xuất kho</button></div>
      </div>

      <div className="inventory-toolbar">
        <label className="inventory-store-filter"><span>Cửa hàng</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">Tất cả cửa hàng</option>{stores.map((store) => <option value={store._id} key={store._id}>{store.storeName}{store.status === 'INACTIVE' ? ' · Tạm ngưng' : ''}</option>)}</select></label>
        <div className="inventory-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm sản phẩm trong kho" placeholder="Tìm sản phẩm hoặc mã hàng" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <button className="inventory-refresh" type="button" title="Làm mới tồn kho" aria-label="Làm mới tồn kho" onClick={() => void loadInventory()} disabled={loading}><RefreshCw size={16} /></button>
      </div>

      {referenceError && <div className="admin-inline-error" role="alert">Không tải được dữ liệu cửa hàng/sản phẩm: {referenceError}</div>}
      {notice && <div className="inventory-success" role="status">{notice}</div>}
      <div className="inventory-summary"><span>{filteredInventory.length} dòng tồn kho</span><small>Tồn khả dụng = tồn thực tế − lượng đã giữ cho đơn hàng</small></div>

      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead><tr><th>Sản phẩm</th><th>Cửa hàng</th><th>Tồn thực tế</th><th>Đã giữ</th><th>Tồn khả dụng</th><th>Ngưỡng cảnh báo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td className="inventory-state" colSpan={7}><span className="admin-loading-mark" />Đang tải tồn kho...</td></tr>}
            {!loading && loadError && <tr><td className="inventory-state inventory-state-error" colSpan={7}><strong>Không tải được tồn kho</strong><span>{loadError}</span><button type="button" onClick={() => void loadInventory()}>Thử lại</button></td></tr>}
            {!loading && !loadError && filteredInventory.length === 0 && <tr><td className="inventory-state" colSpan={7}><span className="inventory-empty-icon"><Boxes size={21} /></span><strong>{search ? 'Không tìm thấy sản phẩm trong kho' : 'Chưa có dữ liệu tồn kho'}</strong><span>{search ? 'Thử từ khóa khác.' : 'Nhập kho để ghi nhận tồn hàng cho cửa hàng.'}</span></td></tr>}
            {!loading && !loadError && filteredInventory.map((record) => {
              const product = productById.get(record.productId);
              const available = Math.max(0, record.quantity - record.reservedQuantity);
              const isLow = available <= record.lowStockThreshold;
              return <tr key={record.inventoryId ?? record._id ?? `${record.storeId}-${record.productId}`}>
                <td><div className="inventory-product-cell"><strong>{product?.productName ?? record.productId}</strong><small>{record.productId}</small></div></td>
                <td>{stores.find((store) => store._id === record.storeId)?.storeName ?? record.storeId}</td>
                <td>{currency.format(record.quantity)}</td>
                <td>{currency.format(record.reservedQuantity)}</td>
                <td><span className={`inventory-available ${isLow ? 'low' : ''}`}>{currency.format(available)}</span></td>
                <td>{currency.format(record.lowStockThreshold)}</td>
                <td><div className="inventory-row-actions"><button type="button" title="Nhập hàng" aria-label={`Nhập ${product?.productName ?? record.productId}`} onClick={() => openChange('import', record.productId)}><ArrowDownToLine size={15} /></button><button type="button" title="Xuất hàng" aria-label={`Xuất ${product?.productName ?? record.productId}`} disabled={available <= 0} onClick={() => openChange('export', record.productId)}><ArrowUpFromLine size={15} /></button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">
            <header><div><span className="admin-eyebrow">ĐIỀU CHỈNH TỒN KHO</span><h2 id="inventory-modal-title">{operation === 'import' ? 'Nhập kho' : 'Xuất kho'}</h2></div><button type="button" className="inventory-modal-close" aria-label="Đóng" onClick={closeForm}><X size={19} /></button></header>
            <form onSubmit={(event) => void submitChange(event)}>
              <label>Cửa hàng <span>*</span><select value={form.storeId} onChange={(event) => setForm((current) => ({ ...current, storeId: event.target.value }))} required><option value="" disabled>Chọn cửa hàng</option>{stores.map((store) => <option value={store._id} key={store._id}>{store.storeName}</option>)}</select></label>
              <label>Sản phẩm <span>*</span><select value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))} required><option value="" disabled>Chọn sản phẩm</option>{products.map((product) => <option value={product.productId} key={product.productId}>{product.productName}{product.status === 'INACTIVE' ? ' · Ngừng bán' : ''}</option>)}</select></label>
              {operation === 'export' && form.storeId && form.productId && <p className="inventory-available-hint">Tồn khả dụng: <strong>{currency.format(Math.max(0, (inventory.find((item) => item.storeId === form.storeId && item.productId === form.productId)?.quantity ?? 0) - (inventory.find((item) => item.storeId === form.storeId && item.productId === form.productId)?.reservedQuantity ?? 0)))}</strong></p>}
              <label>Số lượng <span>*</span><input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))} required /></label>
              {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
              <footer><button className="inventory-secondary-button" type="button" onClick={closeForm} disabled={saving}>Hủy</button><button className={operation === 'import' ? 'inventory-import-button' : 'inventory-export-button'} type="submit" disabled={saving}>{saving ? 'Đang xử lý...' : operation === 'import' ? <><ArrowDownToLine size={15} /> Xác nhận nhập</> : <><ArrowUpFromLine size={15} /> Xác nhận xuất</>}</button></footer>
            </form>
          </section>
        </div>
      )}
      {products.length === 0 && !loading && !referenceError && <p className="inventory-product-note"><PackageSearch size={14} /> Cần có sản phẩm trước khi điều chỉnh tồn kho.</p>}
    </section>
  );
}
