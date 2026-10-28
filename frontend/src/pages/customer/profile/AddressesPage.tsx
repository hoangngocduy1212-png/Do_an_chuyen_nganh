import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { usersApi, type CustomerAddress } from '../../../api/users';
import { AddressForm } from '../../../components/account/AddressForm';
import { ConfirmDialog } from '../../../components/account/ConfirmDialog';
import { storeSelectionStore } from '../../../store/storeSelectionStore';

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() { setLoading(true); try { const items = await usersApi.addresses(); setAddresses(items); const defaultAddress = items.find((item) => item.isDefault); if (defaultAddress) storeSelectionStore.setDeliveryAddress(defaultAddress.addressLine); setError(''); } catch { setError('Không tải được địa chỉ. Vui lòng thử lại.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function save(input: Omit<CustomerAddress, 'addressId'>) {
    if (!editing && addresses.length >= 5) throw new Error('Bạn chỉ có thể lưu tối đa 5 địa chỉ.');
    if (editing) await usersApi.updateAddress(editing.addressId, input); else await usersApi.createAddress(input);
    setEditing(null); setCreating(false); await load(); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã lưu địa chỉ' }));
  }
  async function remove() { if (!deleting) return; if (deleting.isDefault && addresses.length === 1) { setNotice('Không thể xóa địa chỉ mặc định cuối cùng.'); setDeleting(null); return; } const wasDefault = deleting.isDefault; await usersApi.deleteAddress(deleting.addressId); if (wasDefault) { const replacement = addresses.find((address) => address.addressId !== deleting.addressId); if (replacement) await usersApi.setDefaultAddress(replacement.addressId); } setDeleting(null); await load(); }
  async function makeDefault(address: CustomerAddress) { await usersApi.setDefaultAddress(address.addressId); await load(); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã đặt làm địa chỉ mặc định' })); }
  return <section className="account-panel"><header className="account-panel-heading"><div><span className="section-eyebrow">NHẬN HÀNG THUẬN TIỆN</span><h2>Địa chỉ đã lưu</h2></div>{!creating && !editing && <button className="account-outline-button" type="button" onClick={() => setCreating(true)}><Plus size={16} /> Thêm địa chỉ</button>}</header>
    {notice && <p className="address-notice" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></p>}
    {loading ? <div className="account-loading">Đang tải địa chỉ...</div> : error ? <div className="account-error" role="alert">{error}<button type="button" onClick={() => void load()}>Thử lại</button></div> : addresses.length ? <div className="address-list">{addresses.map((address) => <article className="saved-address" key={address.addressId}><span className="saved-address-icon"><MapPin size={19} /></span><div className="saved-address-copy"><div><strong>{address.label}</strong><strong>{address.recipientName}</strong><span>{address.phoneNumber}</span>{address.isDefault && <small>Mặc định</small>}</div><p>{address.addressLine}</p></div><div className="saved-address-actions"><button className="icon-button" type="button" aria-label="Sửa địa chỉ" onClick={() => { setEditing(address); setCreating(false); }}><Pencil size={16} /></button>{!address.isDefault && <button className="icon-button" type="button" aria-label="Đặt làm mặc định" title="Đặt làm mặc định" onClick={() => void makeDefault(address)}><Star size={16} /></button>}<button className="icon-button danger-icon" type="button" aria-label="Xóa địa chỉ" onClick={() => setDeleting(address)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="account-empty"><MapPin size={26} /><p>Bạn chưa lưu địa chỉ nào</p><button className="primary-button account-small-button" type="button" onClick={() => setCreating(true)}>Thêm địa chỉ</button></div>}
    {(creating || editing) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCreating(false); setEditing(null); } }}><section className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title"><header><div><span className="section-eyebrow">SỔ ĐỊA CHỈ</span><h3 id="address-modal-title">{editing ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</h3></div><button className="icon-button" type="button" aria-label="Đóng" onClick={() => { setCreating(false); setEditing(null); }}>×</button></header><AddressForm key={editing?.addressId ?? 'new'} initial={editing ?? undefined} onSave={save} onCancel={() => { setCreating(false); setEditing(null); }} /></section></div>}
    <ConfirmDialog open={Boolean(deleting)} title="Xóa địa chỉ này?" description="Địa chỉ sẽ bị xóa khỏi danh sách đã lưu." confirmLabel="Xóa địa chỉ" danger onConfirm={() => void remove()} onCancel={() => setDeleting(null)} />
  </section>;
}