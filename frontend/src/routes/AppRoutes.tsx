import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { StaffLayout } from '../layouts/StaffLayout';
import AdminHomePage from '../pages/admin/dashboard/AdminHomePage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import HomePage from '../pages/customer/home/HomePage';
import ProductListPage from '../pages/customer/ProductListPage';
import VoucherPage from '../pages/customer/VoucherPage';
import ProductDetailFallbackPage from '../pages/customer/ProductDetailFallbackPage';
import StaffHomePage from '../pages/staff/orders/StaffHomePage';
import { RequireRole } from './RequireRole';

// Them route moi o day. Khu vuc staff/admin duoc chan theo vai tro.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailFallbackPage />} />
        <Route path="/categories" element={<ProductListPage />} />
        <Route path="/profile/vouchers" element={<VoucherPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/staff" element={<RequireRole roles={['STAFF', 'ADMIN']}><StaffLayout /></RequireRole>}>
        <Route index element={<StaffHomePage />} />
        <Route path="orders" element={<StaffHomePage />} />
      </Route>

      <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AdminLayout /></RequireRole>}>
        <Route index element={<AdminHomePage />} />
        <Route path="dashboard" element={<AdminHomePage />} />
      </Route>
    </Routes>
  );
}
