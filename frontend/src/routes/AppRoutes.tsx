import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { StaffLayout } from '../layouts/StaffLayout';
import AdminHomePage from '../pages/admin/dashboard/AdminHomePage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import HomePage from '../pages/customer/home/HomePage';
import StaffHomePage from '../pages/staff/orders/StaffHomePage';
import { RequireRole } from './RequireRole';

// Them route moi o day. Khu vuc staff/admin duoc chan theo vai tro.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/staff" element={<RequireRole roles={['STAFF', 'ADMIN']}><StaffLayout /></RequireRole>}>
        <Route index element={<StaffHomePage />} />
      </Route>

      <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AdminLayout /></RequireRole>}>
        <Route index element={<AdminHomePage />} />
      </Route>
    </Routes>
  );
}
