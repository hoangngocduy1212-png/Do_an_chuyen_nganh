import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BadgePercent, Heart, HelpCircle, LogOut, MapPin, Package, Shield, UserRound } from 'lucide-react';
import type { AuthUser } from '../../types';
import type { MembershipSummary } from '../../types/user';
import { authSessionApi } from '../../api/authSession';
import { useAuth } from '../../store/AuthContext';

const links = [
  { to: '/profile', label: 'Hồ sơ của tôi', Icon: UserRound, end: true },
  { to: '/orders', label: 'Đơn hàng của tôi', Icon: Package },
  { to: '/profile/addresses', label: 'Địa chỉ đã lưu', Icon: MapPin },
  { to: '/profile/rewards', label: 'Ưu đãi & điểm', Icon: BadgePercent },
  { to: '/profile/reviews', label: 'Đánh giá của tôi', Icon: Heart },
  { to: '/profile/support', label: 'Lịch sử hỗ trợ', Icon: HelpCircle },
  { to: '/profile/security', label: 'Bảo mật tài khoản', Icon: Shield },
];

export function AccountSidebar({ user, membership }: { user: AuthUser; membership: MembershipSummary | null }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  async function logout() {
    try { await authSessionApi.logout(); } catch { /* Local sign-out must still complete. */ }
    signOut();
    navigate('/', { replace: true });
  }
  return <aside className="account-sidebar">
    <section className="account-summary">
      <Link to="/profile" className="account-summary-avatar" aria-label="Mở hồ sơ">{user.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : user.fullName.charAt(0).toLocaleUpperCase('vi')}</Link>
      <div className="account-summary-copy"><strong>{user.fullName}</strong><span>{user.email}</span><small>{membership?.memberLevel ?? 'Thành viên Muadee'}</small></div>
    </section>
    <nav className="account-nav" aria-label="Tài khoản của tôi">
      {links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `account-nav-link${isActive ? ' active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}
      <div className="account-nav-divider" />
      <button className="account-nav-logout" type="button" onClick={logout}><LogOut size={18} /><span>Đăng xuất</span></button>
    </nav>
  </aside>;
}