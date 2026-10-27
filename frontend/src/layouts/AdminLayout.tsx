import { Link, Outlet } from 'react-router-dom';

// TODO (nhom): them menu admin: san pham, kho, nguoi dung, bao cao, AI
export function AdminLayout() {
  return (
    <>
      <header className="topbar"><Link to="/" className="brand">Quản trị viên</Link></header>
      <main className="container"><Outlet /></main>
    </>
  );
}
