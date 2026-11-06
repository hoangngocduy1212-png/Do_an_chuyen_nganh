import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, UserRoundPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { employeesApi, type CreateEmployeeInput, type CreatedEmployee } from '../../../api/employees';
import { errorMessage } from '../../../api/client';
import { storesApi, type StoreManagementRecord } from '../../../api/stores';
import './AdminCreateEmployeePage.css';

const emptyForm: CreateEmployeeInput = {
  fullName: '', email: '', phone: '', employeeCode: '', employeeRole: '', storeId: '', password: '',
};

export default function AdminCreateEmployeePage() {
  const [form, setForm] = useState<CreateEmployeeInput>(emptyForm);
  const [confirmation, setConfirmation] = useState('');
  const [stores, setStores] = useState<StoreManagementRecord[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeError, setStoreError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<CreatedEmployee | null>(null);

  async function loadStores() {
    setLoadingStores(true);
    setStoreError('');
    try { setStores((await storesApi.adminList()).filter((store) => store.status === 'ACTIVE')); }
    catch (cause) { setStoreError(errorMessage(cause)); }
    finally { setLoadingStores(false); }
  }

  useEffect(() => { void loadStores(); }, []);

  function update(field: keyof CreateEmployeeInput, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError('');
    setCreated(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const employeeRole = form.employeeRole.trim();
    if (fullName.length < 2 || employeeRole.length < 2) {
      setError('Họ tên và vị trí công việc phải có ít nhất 2 ký tự.');
      return;
    }
    if (!/^0\d{9}$/.test(form.phone.trim())) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.');
      return;
    }
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(form.employeeCode.trim())) {
      setError('Mã nhân viên gồm 2–30 chữ, số, dấu gạch ngang hoặc gạch dưới.');
      return;
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ cái và chữ số.');
      return;
    }
    if (form.password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await employeesApi.create({ ...form, fullName, employeeRole, phone: form.phone.trim(), email: form.email.trim(), employeeCode: form.employeeCode.trim() });
      setCreated(result);
      setForm(emptyForm);
      setConfirmation('');
      setShowPassword(false);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <section className="employee-create-page">
    <div className="admin-page-heading"><div><span className="admin-eyebrow">QUẢN LÝ NHÂN SỰ</span><h1>Tạo tài khoản nhân viên</h1><p className="employee-create-intro">Thêm nhân viên và gán vào cửa hàng để bắt đầu xử lý đơn hàng.</p></div></div>
    {created && <div className="employee-create-success" role="status"><CheckCircle2 size={21} /><div><strong>Đã tạo tài khoản cho {created.fullName}</strong><p>Email đăng nhập: {created.email} · Mã nhân viên: {created.employeeCode}</p><Link to="/login">Đến trang đăng nhập</Link></div></div>}
    <div className="employee-create-card">
      <div className="employee-card-heading"><span className="employee-card-icon"><UserRoundPlus size={20} /></span><div><h2>Thông tin nhân viên</h2><p>Các trường đánh dấu * là bắt buộc.</p></div></div>
      <form onSubmit={submit}>
        <div className="employee-form-grid">
          <label>Họ và tên <span>*</span><input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} autoComplete="name" required minLength={2} maxLength={100} placeholder="Ví dụ: Nguyễn Văn An" /></label>
          <label>Email đăng nhập <span>*</span><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="off" required placeholder="nhanvien@example.com" /></label>
          <label>Số điện thoại <span>*</span><input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} inputMode="numeric" autoComplete="tel" required placeholder="0901234567" /></label>
          <label>Mã nhân viên <span>*</span><input value={form.employeeCode} onChange={(event) => update('employeeCode', event.target.value)} required maxLength={30} placeholder="Ví dụ: NV0002" /></label>
          <label>Vị trí công việc <span>*</span><input value={form.employeeRole} onChange={(event) => update('employeeRole', event.target.value)} required minLength={2} maxLength={100} placeholder="Ví dụ: Nhân viên cửa hàng" /></label>
          <label>Cửa hàng <span>*</span><select value={form.storeId} onChange={(event) => update('storeId', event.target.value)} required disabled={loadingStores || !!storeError}><option value="">{loadingStores ? 'Đang tải cửa hàng...' : 'Chọn cửa hàng'}</option>{stores.map((store) => <option value={store._id} key={store._id}>{store.storeName}</option>)}</select></label>
          <label>Mật khẩu <span>*</span><div className="employee-password"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} placeholder="Ít nhất 8 ký tự" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small>Gồm ít nhất một chữ cái và một chữ số.</small></label>
          <label>Nhập lại mật khẩu <span>*</span><input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} autoComplete="new-password" required minLength={8} maxLength={72} placeholder="Nhập lại mật khẩu" /></label>
        </div>
        {storeError && <div className="employee-form-error" role="alert">Không tải được cửa hàng: {storeError} <button type="button" onClick={() => void loadStores()}>Thử lại</button></div>}
        {!loadingStores && !storeError && !stores.length && <p className="employee-form-error" role="alert">Chưa có cửa hàng đang hoạt động. Hãy tạo hoặc kích hoạt cửa hàng trước.</p>}
        {error && <p className="employee-form-error" role="alert">{error}</p>}
        <div className="employee-form-footer"><p>Nhân viên đăng nhập bằng email và mật khẩu vừa tạo.</p><button className="admin-primary-button" type="submit" disabled={saving || loadingStores || !!storeError || !stores.length}><UserRoundPlus size={16} />{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</button></div>
      </form>
    </div>
  </section>;
}
