import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { StaffLayout } from '../layouts/StaffLayout';
import AdminHomePage from '../pages/admin/dashboard/AdminHomePage';
import AdminCategoriesPage from '../pages/admin/categories/AdminCategoriesPage';
import AdminStoresPage from '../pages/admin/stores/AdminStoresPage';
import AdminProductsPage from '../pages/admin/products/AdminProductsPage';
import AdminVouchersPage from '../pages/admin/vouchers/AdminVouchersPage';
import AdminInventoryPage from '../pages/admin/inventory/AdminInventoryPage';
import AdminOrdersPage from '../pages/admin/orders/AdminOrdersPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import HomePage from '../pages/customer/home/HomePage';
import ProductListPage from '../pages/customer/ProductListPage';
import VoucherPage from '../pages/customer/VoucherPage';
import ProductDetailFallbackPage from '../pages/customer/ProductDetailFallbackPage';
import ProductDetailPage from '../pages/customer/ProductDetailPage';
import CartPage from '../pages/customer/CartPage';
import CheckoutPage from '../pages/customer/CheckoutPage';
import PaymentPage from '../pages/customer/PaymentPage';
import PaymentResultPage from '../pages/customer/PaymentResultPage';
import OrderSuccessPage from '../pages/customer/OrderSuccessPage';
import CustomerOrdersPage from '../pages/customer/OrdersPage';
import OrderDetailPage from '../pages/customer/OrderDetailPage';
import StaffHomePage from '../pages/staff/orders/StaffHomePage';
import { RequireRole } from './RequireRole';
import AccountLayout from '../layouts/AccountLayout';
import ProfileInfoPage from '../pages/customer/profile/ProfileInfoPage';
import AddressesPage from '../pages/customer/profile/AddressesPage';
import RewardsPage from '../pages/customer/profile/RewardsPage';
import ReviewsPage from '../pages/customer/profile/ReviewsPage';
import SupportHistoryPage from '../pages/customer/profile/SupportHistoryPage';
import SecurityPage from '../pages/customer/profile/SecurityPage';

// Them route moi o day. Khu vuc staff/admin duoc chan theo vai tro.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/categories" element={<ProductListPage />} />
      </Route>

      <Route element={<RequireRole roles={['CUSTOMER']}><CustomerLayout /></RequireRole>}>
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/payment/result" element={<PaymentResultPage />} />
        <Route path="/orders/:id/success" element={<OrderSuccessPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Route>

      <Route element={<RequireRole roles={['CUSTOMER']}><CustomerLayout /></RequireRole>}>
        <Route element={<RequireRole roles={['CUSTOMER']}><AccountLayout /></RequireRole>}>
          <Route path="/profile" element={<ProfileInfoPage />} />
          <Route path="/profile/addresses" element={<AddressesPage />} />
          <Route path="/profile/rewards" element={<RewardsPage />} />
          <Route path="/profile/reviews" element={<ReviewsPage />} />
          <Route path="/profile/support" element={<SupportHistoryPage />} />
          <Route path="/profile/security" element={<SecurityPage />} />
          <Route path="/orders" element={<CustomerOrdersPage />} />
        </Route>
        <Route path="/profile/vouchers" element={<VoucherRedirect />} />
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
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="stores" element={<AdminStoresPage />} />
        <Route path="vouchers" element={<AdminVouchersPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="orders/:id" element={<AdminOrdersPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

function VoucherRedirect() {
  return <Navigate to="/profile/rewards?tab=vouchers" replace />;
}
