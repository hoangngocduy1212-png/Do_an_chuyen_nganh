import { useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, MapPin, Pencil, UserRound } from 'lucide-react';
import { usersApi } from '../../../api/users';
import { ordersApi } from '../../../api/orders';
import { membershipsApi } from '../../../api/memberships';
import { MembershipCard } from '../../../components/account/MembershipCard';
import { RecentOrdersCard } from '../../../components/account/RecentOrdersCard';
import { AvatarUploader } from '../../../components/account/AvatarUploader';
import { useAuth } from '../../../store/AuthContext';
import type { MembershipSummary, UserProfile } from '../../../types/user';
import type { CustomerOrder } from '../../../types/order';

interface AccountContext { profile: UserProfile | null; setProfile: (profile: UserProfile | null) => void; membership: MembershipSummary | null; setMembership: (membership: MembershipSummary | null) => void; profileError: boolean; setProfileError: (failed: boolean) => void; membershipError: boolean; setMembershipError: (failed: boolean) => void }

function formatMemberSince(value?: string) {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  return `tháng ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export default function ProfileInfoPage() {
  const { profile, setProfile, membership, profileError, setProfileError, membershipError, setMembership, setMembershipError } = useOutletContext<AccountContext>();
  const { updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phoneNumber?: string }>({});
  const hasUnsavedChanges = Boolean(draft && profile && (draft.fullName !== profile.fullName || draft.phoneNumber !== profile.phoneNumber || draft.avatarUrl !== profile.avatarUrl));
  async function loadOrders() { setOrdersError(false); setOrdersLoading(true); try { setOrders(await ordersApi.mine(3)); } catch { setOrdersError(true); } finally { setOrdersLoading(false); } }
  useEffect(() => { void loadOrders(); }, []);
  async function retryProfile() { setProfileError(false); try { const result = await usersApi.me(); setProfile(result); updateUser(result); } catch { setProfileError(true); } }
  async function retryMembership() { setMembershipError(false); try { setMembership(await membershipsApi.me()); } catch { setMembershipError(true); } }
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.origin !== window.location.origin || !link.pathname.startsWith('/')) return;
      if (!window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời khỏi trang?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [hasUnsavedChanges]);
  function cancelEdit() {
    if (draft && profile && JSON.stringify(draft) !== JSON.stringify(profile) && !window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn hủy?')) return;
    setDraft(null); setEditing(false); setErrors({});
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const nextErrors: typeof errors = {};
    if (draft.fullName.trim().length < 2 || draft.fullName.trim().length > 100) nextErrors.fullName = 'Họ và tên phải từ 2 đến 100 ký tự';
    if (!/^0\d{9}$/.test(draft.phoneNumber ?? '')) nextErrors.phoneNumber = 'Số điện thoại không hợp lệ';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ fullName: draft.fullName.trim(), phoneNumber: draft.phoneNumber, avatarUrl: draft.avatarUrl });
      setProfile(updated); updateUser(updated); setEditing(false); setDraft(null);
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã cập nhật thông tin' }));
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể cập nhật thông tin. Vui lòng thử lại.' })); }
    finally { setSaving(false); }
  }
  const visible = editing ? draft : profile;
  return <div className="account-page-stack">
    <section className="account-panel profile-info-panel"><header className="account-panel-heading"><div><span className="section-eyebrow">THÔNG TIN TÀI KHOẢN</span><h2>Thông tin cá nhân</h2></div>{!editing && <button className="account-outline-button" type="button" onClick={() => { setDraft(profile ? { ...profile } : null); setEditing(true); }}><Pencil size={15} /> Chỉnh sửa</button>}</header>
      {visible && <form onSubmit={save} className="profile-info-form"><AvatarUploader value={visible.avatarUrl} name={visible.fullName} onChange={(avatarUrl) => { setDraft((current) => current ? { ...current, avatarUrl } : profile ? { ...profile, avatarUrl } : current); setEditing(true); }} />
        <div className="account-form-grid"><label className="account-field">Họ và tên<input readOnly={!editing} value={visible.fullName} onChange={(event) => setDraft((current) => current ? { ...current, fullName: event.target.value } : current)} />{errors.fullName && <span className="account-field-error">{errors.fullName}</span>}</label><label className="account-field">Số điện thoại<input readOnly={!editing} inputMode="numeric" value={visible.phoneNumber ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 10) } : current)} />{errors.phoneNumber && <span className="account-field-error">{errors.phoneNumber}</span>}</label><label className="account-field">Email<input readOnly value={visible.email} /><small>Email dùng để đăng nhập nên không thể thay đổi</small></label><div className="account-field">Thành viên từ<strong className="account-readonly-value">{formatMemberSince(visible.createdAt)}</strong></div><div className="account-field full-width"><span>Địa chỉ giao hàng mặc định</span><strong className="account-readonly-value address-readonly"><MapPin size={16} />{visible.defaultAddress || 'Chưa có địa chỉ mặc định'}<Link to="/profile/addresses">Quản lý địa chỉ <ArrowRight size={14} /></Link></strong></div></div>
        {editing && <div className="account-form-actions"><button className="secondary-button" type="button" onClick={cancelEdit}>Hủy</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>}
      </form>}
      {!visible && (profileError ? <div className="account-error" role="alert"><span>Không tải được dữ liệu</span><button type="button" onClick={() => void retryProfile()}>Thử lại</button></div> : <div className="account-skeleton" aria-label="Đang tải hồ sơ"><i /><i /><i /></div>)}
    </section>
    {membership && <MembershipCard membership={membership} />}{!membership && !membershipError && <div className="membership-skeleton" aria-label="Đang tải hạng thành viên"><i /><i /></div>}{membershipError && <div className="account-error" role="alert"><span>Không tải được dữ liệu thành viên</span><button type="button" onClick={() => void retryMembership()}>Thử lại</button></div>}
    {ordersError ? <div className="account-panel account-error" role="alert"><span>Không tải được dữ liệu đơn hàng</span><button type="button" onClick={() => void loadOrders()}>Thử lại</button></div> : ordersLoading ? <div className="account-panel account-skeleton" aria-label="Đang tải đơn hàng"><i /><i /><i /></div> : <RecentOrdersCard orders={orders} />}
  </div>;
}