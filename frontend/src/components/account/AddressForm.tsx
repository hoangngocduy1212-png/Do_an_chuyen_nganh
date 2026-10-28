import { useState, type FormEvent } from 'react';
import type { CustomerAddress } from '../../api/users';

export function AddressForm({ initial, onSave, onCancel }: { initial?: CustomerAddress; onSave: (address: Omit<CustomerAddress, 'addressId'>) => Promise<void>; onCancel: () => void }) {
  const [label, setLabel] = useState<CustomerAddress['label']>(initial?.label ?? 'Nhà');
  const [name, setName] = useState(initial?.recipientName ?? '');
  const [phone, setPhone] = useState(initial?.phoneNumber ?? '');
  const [address, setAddress] = useState(initial?.addressLine ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; address?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (name.trim().length < 2 || name.trim().length > 100) nextErrors.name = 'Vui lòng nhập tên người nhận từ 2 đến 100 ký tự.';
    if (!/^0\d{9}$/.test(phone)) nextErrors.phone = 'Số điện thoại phải có 10 số và bắt đầu bằng 0.';
    if (address.trim().length < 12) nextErrors.address = 'Vui lòng nhập đầy đủ số nhà, đường, phường/xã, quận/huyện và tỉnh/thành.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try { await onSave({ label, recipientName: name.trim(), phoneNumber: phone, addressLine: address.trim(), isDefault }); }
    catch (error) { setErrors({ form: error instanceof Error ? error.message : 'Không thể lưu địa chỉ. Vui lòng thử lại.' }); }
    finally { setSaving(false); }
  }
  return <form className="account-form address-form checkout-address-form" onSubmit={submit}>
    <div className="account-form-grid"><label className="account-field">Nhãn địa chỉ<select value={label} onChange={(event) => setLabel(event.target.value as CustomerAddress['label'])}><option>Nhà</option><option>Công ty</option><option>Khác</option></select></label><label className="account-field">Tên người nhận *<input value={name} onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: undefined })); }} aria-invalid={Boolean(errors.name)} />{errors.name && <span className="account-field-error">{errors.name}</span>}</label><label className="account-field">Số điện thoại *<input value={phone} inputMode="numeric" onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setErrors((current) => ({ ...current, phone: undefined })); }} aria-invalid={Boolean(errors.phone)} />{errors.phone && <span className="account-field-error">{errors.phone}</span>}</label><label className="account-field full-width">Địa chỉ *<textarea value={address} onChange={(event) => { setAddress(event.target.value); setErrors((current) => ({ ...current, address: undefined })); }} rows={3} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" aria-invalid={Boolean(errors.address)} />{errors.address && <span className="account-field-error">{errors.address}</span>}</label></div>
    <label className="account-checkbox"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /> Đặt làm địa chỉ mặc định</label>
    {errors.form && <p className="account-field-error" role="alert">{errors.form}</p>}
    <div className="account-form-actions"><button className="secondary-button" type="button" onClick={onCancel}>Hủy</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu địa chỉ'}</button></div>
  </form>;
}