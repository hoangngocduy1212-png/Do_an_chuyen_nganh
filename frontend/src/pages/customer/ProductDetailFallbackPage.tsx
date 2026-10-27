import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ProductDetailFallbackPage() {
  const { id } = useParams();
  return <div className="customer-shell product-detail-fallback"><span className="section-eyebrow">SẢN PHẨM MUADEE</span><h1>Đang cập nhật</h1><p>Sản phẩm {id} đang được bổ sung thông tin. Bạn có thể tiếp tục xem các sản phẩm khác.</p><Link to="/products"><ArrowLeft size={17} />Quay lại mua sắm</Link></div>;
}