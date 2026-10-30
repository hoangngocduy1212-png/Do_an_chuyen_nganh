import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PackageSearch,
  TicketPercent,
} from 'lucide-react';
import { authSessionApi } from '../api/authSession';
import { useAuth } from '../store/AuthContext';
import './AdminLayout.css';

const adminSections = [
  { label: 'Tổng quan', path: '/admin', icon: LayoutDashboard },
  { label: 'Sản phẩm', path: '/admin/products', icon: PackageSearch },
  { label: 'Danh mục', path: '/admin/categories', icon: FolderTree },
  { label: 'Cửa hàng', path: '/admin/stores', icon: MapPinned },
  { label: 'Voucher', path: '/admin/vouchers', icon: TicketPercent },
  { label: 'Tồn kho', path: '/admin/inventory', icon: Boxes },
  { label: 'Đơn hàng', path: '/admin/orders', icon: ClipboardList },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await authSessionApi.logout();
    } catch {
      // Local sign-out must still complete if the API is unavailable.
    }
    signOut();
    navigate('/', { replace: true });
  }

  const navigation = (className: string) => (
    <nav className={className} aria-label="Điều hướng quản trị">
      {adminSections.map(({ label, path, icon: Icon }) => (
        <NavLink key={path} to={path} end={path === '/admin'} className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}>
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
          <span>muadee<small>OPERATIONS</small></span>
        </a>
        <div className="admin-side-label">QUẢN LÝ</div>
        {navigation('admin-sidebar-nav')}
        <div className="admin-sidebar-foot">Muadee Supermarket <span>Admin console</span></div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-header">
          <div className="admin-header-context"><span>MU A DEE / QUẢN TRỊ</span><strong>Không gian vận hành</strong></div>
          <div className="admin-user">
            <span className="admin-user-avatar" aria-hidden="true">{user?.fullName.charAt(0).toLocaleUpperCase('vi-VN') ?? 'A'}</span>
            <span className="admin-user-name"><strong>{user?.fullName ?? 'Quản trị viên'}</strong><small>ADMIN</small></span>
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
