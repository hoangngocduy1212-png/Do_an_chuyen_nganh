import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, ClipboardList, Headset, LogOut, Star, UserRound, TicketPercent } from 'lucide-react';
import { authSessionApi } from '../api/authSession';
import { useAuth } from '../store/AuthContext';
import './AdminLayout.css';
import '../pages/staff/staff.css';

const staffSections = [
  { label: 'Đơn hàng', path: '/staff/orders', icon: ClipboardList },
  { label: 'Phản ánh đơn', path: '/staff/issues', icon: AlertTriangle },
  { label: 'Tồn kho', path: '/staff/inventory', icon: Boxes },
  { label: 'Đánh giá', path: '/staff/reviews', icon: Star },
  { label: 'Chăm sóc KH', path: '/staff/support', icon: Headset },
  { label: 'Voucher', path: '/staff/vouchers', icon: TicketPercent },
  { label: 'Hồ sơ', path: '/staff/profile', icon: UserRound },
];

export function StaffLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await authSessionApi.logout();
    } catch {
      // Đăng xuất cục bộ vẫn phải hoàn tất khi API không khả dụng.
    }
    signOut();
    navigate('/', { replace: true });
  }

  const navigation = (className: string) => (
    <nav className={className} aria-label="Điều hướng nhân viên">
      {staffSections.map(({ label, path, icon: Icon }) => (
        <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span className="admin-brand-mark">m</span>
          <span>muadee<small>STAFF</small></span>
        </a>
        <div className="admin-side-label">NHÂN VIÊN CỬA HÀNG</div>
        {navigation('admin-sidebar-nav')}
        <div className="admin-sidebar-foot">Muadee Supermarket <span>Staff console</span></div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-header">
          <div className="admin-header-context"><span>MU A DEE / NHÂN VIÊN</span><strong>Vận hành cửa hàng</strong></div>
          <div className="admin-user">
            <span className="admin-user-avatar" aria-hidden="true">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user?.fullName.charAt(0).toLocaleUpperCase('vi-VN') ?? 'N'}</span>
            <span className="admin-user-name"><strong>{user?.fullName ?? 'Nhân viên'}</strong><small>{user?.role ?? 'STAFF'}</small></span>
            <button className="admin-logout" type="button" onClick={logout} disabled={loggingOut} aria-label="Đăng xuất" title="Đăng xuất">
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {navigation('admin-mobile-nav')}
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
