import { Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';

export default function OrdersPage() {
  return <div className="customer-shell orders-coming-soon"><section className="account-panel"><span className="orders-coming-icon"><Package size={28} /></span><span className="section-eyebrow">ĐƠN HÀNG MUADEE</span><h1>Đang cập nhật</h1><p>Trang quản lý đơn hàng của bạn sẽ sớm có mặt. Bạn vẫn có thể tiếp tục khám phá các sản phẩm tươi ngon.</p><Link className="primary-button account-small-button" to="/profile"><ArrowLeft size={16} /> Quay lại tài khoản</Link></section></div>;
}