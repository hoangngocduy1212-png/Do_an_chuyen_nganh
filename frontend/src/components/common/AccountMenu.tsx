import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleUserRound, LogOut, Shield, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AuthUser } from '../../types';
import type { MembershipSummary } from '../../types/user';
import { membershipsApi } from '../../api/memberships';
import { authSessionApi } from '../../api/authSession';
import { useAuth } from '../../store/AuthContext';

export function AccountMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  useEffect(() => {
    if (user.role === 'CUSTOMER') membershipsApi.me().then(setMembership).catch(() => setMembership({ pointBalance: 1250, memberLevel: 'Bạc' }));
  }, [user.role]);

  useEffect(() => {
    function dismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false);
      if (event instanceof MouseEvent && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, []);

  async function logout() {
    try { await authSessionApi.logout(); } catch { /* Local sign-out must still complete. */ }
    signOut();
    window.location.assign('/');
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button className="account-trigger" type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        <span className="account-avatar"><CircleUserRound size={20} /></span>
        <span className="account-greeting"><small>Xin chào</small><strong>{user.fullName}</strong></span><ChevronDown size={16} />
      </button>
      {open && <div className="account-dropdown" role="menu">
        <div className="account-dropdown-heading"><strong>{user.fullName}</strong><span>{user.email}</span></div>
        {user.role === 'CUSTOMER' ? <>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}><UserRound size={17} /> Hồ sơ của tôi</Link>
          <Link role="menuitem" to="/orders" onClick={() => setOpen(false)}>Đơn hàng của tôi</Link>
          <Link role="menuitem" to="/profile/vouchers" onClick={() => setOpen(false)}>Voucher của tôi</Link>
          <div className="membership-line">{membership ? `${membership.pointBalance.toLocaleString('vi-VN')} điểm · Hạng ${membership.memberLevel}` : 'Đang tải điểm thành viên...'}</div>
        </> : <Link role="menuitem" to={user.role === 'ADMIN' ? '/admin/dashboard' : '/staff/orders'} onClick={() => setOpen(false)}><Shield size={17} /> Vào trang quản lý</Link>}
        <button role="menuitem" className="account-logout" type="button" onClick={logout}><LogOut size={17} /> Đăng xuất</button>
      </div>}
    </div>
  );
}