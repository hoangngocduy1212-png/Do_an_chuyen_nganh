import { Link, Outlet } from 'react-router-dom';

// TODO (nhom): them menu theo cac man hinh staff: don hang, san pham, CSKH, danh gia
export function StaffLayout() {
  return (
    <>
      <header className="topbar"><Link to="/" className="brand">Nhân viên cửa hàng</Link></header>
      <main className="container"><Outlet /></main>
    </>
  );
}
