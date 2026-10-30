import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MapPinned, Pencil, Plus, Search, X } from 'lucide-react';
import { errorMessage } from '../../../api/client';
import { storesApi, type StoreManagementInput, type StoreManagementRecord } from '../../../api/stores';
import './AdminStoresPage.css';

const emptyForm: StoreManagementInput = { storeName: '', address: '', phone: '', status: 'ACTIVE' };

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StoreManagementInput['status']>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreManagementRecord | null>(null);
  const [form, setForm] = useState<StoreManagementInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadStores() {
    setLoading(true);
    setLoadError('');
    try {
      setStores(await storesApi.adminList());
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadStores(); }, []);

  const filteredStores = useMemo(() => stores.filter((store) => {
    const matchesText = `${store.storeName} ${store.address} ${store.phone}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    return matchesText && (statusFilter === 'ALL' || store.status === statusFilter);
  }), [stores, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function openEdit(store: StoreManagementRecord) {
    setEditing(store);
    setForm({ storeName: store.storeName, address: store.address, phone: store.phone, status: store.status });
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: StoreManagementInput = {
      storeName: form.storeName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      status: form.status,
    };
    if (!input.storeName || !input.address || !input.phone) {
      setFormError('Vui lòng nhập đầy đủ tên, địa chỉ và số điện thoại.');
      return;
    }
    setSaving(true);
    setFormError('');
    setActionError('');
    try {
      if (editing) await storesApi.adminUpdate(editing._id, input);
      else await storesApi.adminCreate(input);
      setFormOpen(false);
      setEditing(null);
      await loadStores();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-stores">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">VẬN HÀNH CHI NHÁNH</span><h1>Cửa hàng</h1></div>
        <button className="admin-primary-button" type="button" onClick={openCreate}><Plus size={16} /> Thêm cửa hàng</button>
      </div>

      <div className="stores-toolbar">
        <div className="stores-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm cửa hàng" placeholder="Tìm tên, địa chỉ hoặc số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label className="stores-status-filter"><span>Trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Tạm ngưng</option></select></label>
        <span className="stores-count">{filteredStores.length} / {stores.length}</span>
      </div>

      {actionError && <div className="admin-inline-error" role="alert">{actionError}</div>}

      <div className="stores-table-wrap">
        <table className="stores-table">
          <thead><tr><th>Cửa hàng</th><th>Địa chỉ</th><th>Điện thoại</th><th>Trạng thái</th><th className="stores-actions-heading">Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td className="stores-state" colSpan={5}><span className="admin-loading-mark" />Đang tải cửa hàng...</td></tr>}
            {!loading && loadError && <tr><td className="stores-state stores-state-error" colSpan={5}><strong>Không tải được cửa hàng</strong><span>{loadError}</span><button type="button" onClick={() => void loadStores()}>Thử lại</button></td></tr>}
            {!loading && !loadError && filteredStores.length === 0 && <tr><td className="stores-state" colSpan={5}><span className="stores-empty-icon"><MapPinned size={21} /></span><strong>{search || statusFilter !== 'ALL' ? 'Không tìm thấy cửa hàng phù hợp' : 'Chưa có cửa hàng nào'}</strong><span>{search || statusFilter !== 'ALL' ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Thêm cửa hàng đầu tiên để bắt đầu quản lý.'}</span></td></tr>}
            {!loading && !loadError && filteredStores.map((store) => (
              <tr key={store._id}>
                <td><div className="stores-name-cell"><span className="stores-marker"><MapPinned size={16} /></span><strong>{store.storeName}</strong></div></td>
                <td className="stores-address">{store.address}</td>
                <td className="stores-phone">{store.phone}</td>
                <td><span className={`stores-status-badge ${store.status === 'ACTIVE' ? 'active' : 'inactive'}`}><i />{store.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}</span></td>
                <td><div className="stores-row-actions"><button type="button" aria-label={`Chỉnh sửa ${store.storeName}`} title="Chỉnh sửa cửa hàng" onClick={() => openEdit(store)}><Pencil size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="stores-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="stores-modal" role="dialog" aria-modal="true" aria-labelledby="stores-modal-title">
            <header><div><span className="admin-eyebrow">CỬA HÀNG</span><h2 id="stores-modal-title">{editing ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng'}</h2></div><button type="button" className="stores-modal-close" aria-label="Đóng" onClick={closeForm}><X size={19} /></button></header>
            <form onSubmit={(event) => void submitForm(event)}>
              <label>Tên cửa hàng <span>*</span><input autoFocus maxLength={150} value={form.storeName} onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))} placeholder="Ví dụ: Muadee Nguyễn Trãi" required /></label>
              <label>Địa chỉ <span>*</span><textarea rows={3} maxLength={300} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Số nhà, đường, phường/xã, quận/huyện" required /></label>
              <label>Số điện thoại <span>*</span><input type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="028 1234 5678" required /></label>
              <label>Trạng thái<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as StoreManagementInput['status'] }))}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Tạm ngưng</option></select></label>
              {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
              <footer><button className="stores-secondary-button" type="button" onClick={closeForm} disabled={saving}>Hủy</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo cửa hàng'}</button></footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}