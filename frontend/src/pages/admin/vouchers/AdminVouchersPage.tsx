import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, TicketPercent, Trash2, X } from 'lucide-react';
import { errorMessage } from '../../../api/client';
import { vouchersApi, type AdminVoucherInput, type AdminVoucherRecord } from '../../../api/vouchers';
import './AdminVouchersPage.css';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
interface VoucherForm {
  code: string;
  description: string;
  discountValue: string;
  minOrderAmount: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  usageLimit: string;
}
const emptyForm: VoucherForm = { code: '', description: '', discountValue: '', minOrderAmount: '0', startDate: '', endDate: '', status: 'ACTIVE', usageLimit: '' };

function dateTimeLocal(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<AdminVoucherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AdminVoucherInput['status']>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVoucherRecord | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadVouchers() {
    setLoading(true);
    setLoadError('');
    try {
      setVouchers(await vouchersApi.adminList());
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadVouchers(); }, []);

  const filteredVouchers = useMemo(() => vouchers.filter((voucher) => {
    const matchesText = `${voucher.code} ${voucher.description}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'));
    return matchesText && (statusFilter === 'ALL' || voucher.status === statusFilter);
  }), [vouchers, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, startDate: dateTimeLocal(new Date().toISOString()), endDate: dateTimeLocal(new Date(Date.now() + 7 * 86400_000).toISOString()) });
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function openEdit(voucher: AdminVoucherRecord) {
    setEditing(voucher);
    setForm({
      code: voucher.code,
      description: voucher.description,
      discountValue: String(voucher.discountValue),
      minOrderAmount: String(voucher.minOrderAmount),
      startDate: dateTimeLocal(voucher.startDate),
      endDate: dateTimeLocal(voucher.endDate),
      status: voucher.status,
      usageLimit: voucher.usageLimit === undefined ? '' : String(voucher.usageLimit),
    });
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
    const discountValue = Number(form.discountValue);
    const minOrderAmount = Number(form.minOrderAmount);
    const startDate = new Date(form.startDate);
    const endDate = new Date(form.endDate);
    const usageLimit = form.usageLimit ? Number(form.usageLimit) : undefined;
    if (!form.code.trim() || !form.description.trim() || !form.startDate || !form.endDate) {
      setFormError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setFormError('Giá trị giảm phải lớn hơn 0.');
      return;
    }
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0 || (usageLimit !== undefined && (!Number.isInteger(usageLimit) || usageLimit < 0))) {
      setFormError('Giá trị đơn tối thiểu và lượt sử dụng phải hợp lệ.');
      return;
    }
    if (startDate.getTime() >= endDate.getTime()) {
      setFormError('Ngày bắt đầu phải trước ngày kết thúc.');
      return;
    }
    const input: AdminVoucherInput = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountValue,
      minOrderAmount,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: form.status,
      ...(usageLimit === undefined ? {} : { usageLimit }),
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) await vouchersApi.adminUpdate(editing.voucherId, input);
      else await vouchersApi.adminCreate(input);
      setFormOpen(false);
      setEditing(null);
      await loadVouchers();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeVoucher(voucher: AdminVoucherRecord) {
    if (!window.confirm(`Xóa voucher ${voucher.code}? Thao tác này không thể hoàn tác.`)) return;
    setActionError('');
    try {
      await vouchersApi.adminRemove(voucher.voucherId);
      await loadVouchers();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  return (
    <section className="admin-vouchers">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">ƯU ĐÃI VÀ KHUYẾN MÃI</span><h1>Voucher</h1></div>
        <button className="admin-primary-button" type="button" onClick={openCreate}><Plus size={16} /> Thêm voucher</button>
      </div>

      <div className="vouchers-toolbar">
        <div className="vouchers-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm voucher" placeholder="Tìm mã hoặc mô tả voucher" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label className="vouchers-status-filter"><span>Trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Tạm ngưng</option></select></label>
        <span className="vouchers-count">{filteredVouchers.length} / {vouchers.length}</span>
      </div>

      {actionError && <div className="admin-inline-error" role="alert">{actionError}</div>}

      <div className="vouchers-table-wrap">
        <table className="vouchers-table">
          <thead><tr><th>Mã voucher</th><th>Mức giảm</th><th>Đơn tối thiểu</th><th>Thời hạn</th><th>Lượt dùng</th><th>Trạng thái</th><th className="vouchers-actions-heading">Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td className="vouchers-state" colSpan={7}><span className="admin-loading-mark" />Đang tải voucher...</td></tr>}
            {!loading && loadError && <tr><td className="vouchers-state vouchers-state-error" colSpan={7}><strong>Không tải được voucher</strong><span>{loadError}</span><button type="button" onClick={() => void loadVouchers()}>Thử lại</button></td></tr>}
            {!loading && !loadError && filteredVouchers.length === 0 && <tr><td className="vouchers-state" colSpan={7}><span className="vouchers-empty-icon"><TicketPercent size={21} /></span><strong>{search || statusFilter !== 'ALL' ? 'Không tìm thấy voucher phù hợp' : 'Chưa có voucher nào'}</strong><span>{search || statusFilter !== 'ALL' ? 'Thử từ khóa hoặc trạng thái khác.' : 'Tạo voucher đầu tiên cho khách hàng.'}</span></td></tr>}
            {!loading && !loadError && filteredVouchers.map((voucher) => (
              <tr key={voucher.voucherId}>
                <td><div className="voucher-code-cell"><strong>{voucher.code}</strong><small>{voucher.description}</small></div></td>
                <td className="voucher-discount">{currency.format(voucher.discountValue)}</td>
                <td>{currency.format(voucher.minOrderAmount)}</td>
                <td><span className="voucher-date">{formatDate(voucher.startDate)}</span><span className="voucher-date">{formatDate(voucher.endDate)}</span></td>
                <td>{voucher.usedCount.toLocaleString('vi-VN')} / {voucher.usageLimit === undefined ? '∞' : voucher.usageLimit.toLocaleString('vi-VN')}</td>
                <td><span className={`voucher-status ${voucher.status === 'ACTIVE' ? 'active' : 'inactive'}`}><i />{voucher.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}</span></td>
                <td><div className="vouchers-row-actions"><button type="button" aria-label={`Sửa ${voucher.code}`} title="Chỉnh sửa" onClick={() => openEdit(voucher)}><Pencil size={16} /></button><button type="button" className="voucher-delete" aria-label={`Xóa ${voucher.code}`} title="Xóa" onClick={() => void removeVoucher(voucher)}><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="vouchers-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="vouchers-modal" role="dialog" aria-modal="true" aria-labelledby="vouchers-modal-title">
            <header><div><span className="admin-eyebrow">VOUCHER</span><h2 id="vouchers-modal-title">{editing ? 'Chỉnh sửa voucher' : 'Thêm voucher'}</h2></div><button type="button" className="vouchers-modal-close" aria-label="Đóng" onClick={closeForm}><X size={19} /></button></header>
            <form onSubmit={(event) => void submitForm(event)}>
              <div className="vouchers-form-grid">
                <label>Mã voucher <span>*</span><input autoFocus maxLength={40} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Ví dụ: FRESH20" required /></label>
                <label>Trạng thái<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AdminVoucherInput['status'] }))}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Tạm ngưng</option></select></label>
                <label className="vouchers-form-wide">Mô tả <span>*</span><input maxLength={200} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ưu đãi áp dụng cho đơn hàng" required /></label>
                <label>Mức giảm (VND) <span>*</span><input type="number" min="1" step="1000" value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} required /></label>
                <label>Đơn tối thiểu (VND)<input type="number" min="0" step="1000" value={form.minOrderAmount} onChange={(event) => setForm((current) => ({ ...current, minOrderAmount: event.target.value }))} /></label>
                <label>Ngày bắt đầu <span>*</span><input type="datetime-local" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required /></label>
                <label>Ngày kết thúc <span>*</span><input type="datetime-local" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required /></label>
                <label className="vouchers-form-wide">Giới hạn lượt sử dụng <small>Để trống nếu không giới hạn</small><input type="number" min="0" step="1" value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} placeholder="Không giới hạn" /></label>
              </div>
              {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
              <footer><button className="vouchers-secondary-button" type="button" onClick={closeForm} disabled={saving}>Hủy</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo voucher'}</button></footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
