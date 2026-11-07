import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { staffApi } from '../../api/staff';
import type { AdminVoucherRecord } from '../../api/vouchers';
import { currency, formatDate, Heading } from './shared';

type Row = Partial<AdminVoucherRecord> & { _id?: string };
const empty = { code: '', description: '', discountValue: '', minOrderAmount: '0', usageLimit: '', startDate: '', endDate: '' };

export default function StaffVouchersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await staffApi.vouchers());
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const idOf = (row: Row) => row.voucherId ?? row._id ?? '';

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await run(async () => {
      await staffApi.createVoucher({
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: 'ACTIVE',
      });
      setForm(empty);
    });
    setSaving(false);
  }

  const field = (key: keyof typeof empty) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value })) });

  return (
    <section className="staff-page">
      <Heading eyebrow="KHUYẾN MÃI" title="Voucher" />
      {error && <p className="staff-error" role="alert">{error}</p>}
      <form className="staff-panel staff-form" onSubmit={(event) => void create(event)}>
        <h2>Tạo voucher</h2>
        <div className="staff-form-grid">
          <label>Mã<input required {...field('code')} /></label>
          <label>Mô tả<input required {...field('description')} /></label>
          <label>Giá trị giảm (VND)<input required type="number" min="0" {...field('discountValue')} /></label>
          <label>Đơn tối thiểu<input type="number" min="0" {...field('minOrderAmount')} /></label>
          <label>Giới hạn lượt dùng<input type="number" min="0" {...field('usageLimit')} /></label>
          <label>Bắt đầu<input required type="date" {...field('startDate')} /></label>
          <label>Kết thúc<input required type="date" {...field('endDate')} /></label>
        </div>
        <div><button className="staff-btn" type="submit" disabled={saving}>Tạo voucher</button></div>
      </form>
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Mã</th><th>Mô tả</th><th>Giảm</th><th>Tối thiểu</th><th>Thời hạn</th><th>Đã dùng</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="staff-state">Đang tải...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="staff-state">Chưa có voucher</td></tr>
              : rows.map((row) => (
                <tr key={idOf(row)}>
                  <td><b>{row.code}</b></td>
                  <td>{row.description}</td>
                  <td>{currency.format(row.discountValue ?? 0)}</td>
                  <td>{currency.format(row.minOrderAmount ?? 0)}</td>
                  <td>{formatDate(row.startDate)} – {formatDate(row.endDate)}</td>
                  <td>{row.usedCount ?? 0}{row.usageLimit ? `/${row.usageLimit}` : ''}</td>
                  <td><span className={`staff-badge ${row.status === 'ACTIVE' ? 'ok' : 'bad'}`}>{row.status === 'ACTIVE' ? 'Đang bật' : 'Đã tắt'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="staff-btn secondary" type="button" onClick={() => void run(() => staffApi.updateVoucher(idOf(row), { status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }))}>{row.status === 'ACTIVE' ? 'Tắt' : 'Bật'}</button>{' '}
                    <button className="staff-btn danger" type="button" onClick={() => { if (window.confirm(`Xóa voucher ${row.code}?`)) void run(() => staffApi.deleteVoucher(idOf(row))); }}>Xóa</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
