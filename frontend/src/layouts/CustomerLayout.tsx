import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export function CustomerLayout() {
  const { user, signOut } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Siêu thị B2C</Link>
        <nav>
          {user && (user.role === 'ADMIN' || user.role === 'STAFF') && (
            <Link to={user.role === 'ADMIN' ? '/admin' : '/staff'}>Quản lý</Link>
          )}
          {user ? (
            <>
              <span>Xin chào, {user.fullName}</span>
              <button onClick={signOut}>Đăng xuất</button>
            </>
          ) : (
            <>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </>
          )}
        </nav>
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}
