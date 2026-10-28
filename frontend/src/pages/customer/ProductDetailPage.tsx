import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, MapPin, ShoppingBasket, Star } from 'lucide-react';
import { activitiesApi } from '../../api/activities';
import { cartApi } from '../../api/cart';
import { productsApi } from '../../api/products';
import { recommendationsApi } from '../../api/recommendations';
import { storesApi } from '../../api/stores';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { ProductGallery } from '../../components/product/ProductGallery';
import { QuantitySelector } from '../../components/product/QuantitySelector';
import { ReviewList } from '../../components/product/ReviewList';
import { RecommendationSection } from '../../components/recommendation/RecommendationSection';
import type { Product } from '../../types/product';
import type { StoreLocation } from '../../types/store';
import { useAuth } from '../../store/AuthContext';
import { cartStore } from '../../store/cartStore';
import { useStoreSelection } from '../../store/storeSelectionStore';
import { formatMoney } from '../../utils/money';

export default function ProductDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { storeId } = useStoreSelection();
  const [product, setProduct] = useState<Product | null>(null);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'policy'>('description');
  const [tabAction, setTabAction] = useState<'add' | 'buy'>('add');
  const saleActive = Boolean(product?.salePrice && product.saleStartDate && product.saleEndDate && Date.parse(product.saleStartDate) <= Date.now() && Date.parse(product.saleEndDate) >= Date.now());
  const price = saleActive && product ? product.salePrice as number : product?.price ?? 0;
  const storeName = stores.find((store) => store._id === storeId)?.name ?? 'Cửa hàng đang chọn';
  const soldOut = !product || product.stock <= 0;

  useEffect(() => {
    let active = true;
    setLoading(true);
    productsApi.get(id, storeId).then((value) => { if (active) { setProduct(value); setQuantity(value?.unit === 'kg' ? 0.5 : 1); } }).catch(() => { if (active) setProduct(null); }).finally(() => { if (active) setLoading(false); });
    storesApi.list().then((items) => { if (active) setStores(items); }).catch(() => { if (active) setStores([]); });
    return () => { active = false; };
  }, [id, storeId]);
  useEffect(() => {
    if (!product) return;
    activitiesApi.record('VIEW', product.productId).catch(() => undefined);
    let active = true;
    productsApi.list({ storeId }).then(async (items) => {
      const alternatives = items.filter((item) => item.productId !== product.productId);
      const suggested = await recommendationsApi.product(storeId, alternatives);
      const combined = [...suggested, ...alternatives.filter((item) => !suggested.some((candidate) => candidate.productId === item.productId))];
      if (active) setRecommendations(combined);
    }).catch(() => { if (active) setRecommendations([]); });
    return () => { active = false; };
  }, [product?.productId, storeId]);
  useEffect(() => {
    if (!user || !product || loading) return;
    const pendingProduct = localStorage.getItem('muadee-pending-cart-product');
    const pendingAction = localStorage.getItem('muadee-pending-cart-action');
    if (pendingProduct !== product.productId) return;
    localStorage.removeItem('muadee-pending-cart-product');
    localStorage.removeItem('muadee-pending-cart-action');
    void submitCart(pendingAction === 'buy' ? 'buy' : 'add');
  }, [user, product, loading]);

  async function submitCart(action: 'add' | 'buy') {
    if (!product || soldOut || adding) return;
    if (user?.role !== 'CUSTOMER') {
      localStorage.setItem('muadee-pending-cart-product', product.productId);
      localStorage.setItem('muadee-pending-cart-action', action);
      setTabAction(action);
      window.dispatchEvent(new Event('muadee:login-required'));
      return;
    }
    setAdding(true);
    try {
      await cartApi.add(product.productId, quantity);
      cartStore.add(product, quantity);
      activitiesApi.record('ADD_TO_CART', product.productId).catch(() => undefined);
      window.dispatchEvent(new Event('muadee:cart-added'));
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã thêm vào giỏ hàng' }));
      if (action === 'buy') navigate('/checkout');
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể thêm sản phẩm. Vui lòng thử lại.' })); }
    finally { setAdding(false); }
  }

  const discount = useMemo(() => product && saleActive ? Math.round((1 - price / product.price) * 100) : 0, [product, saleActive, price]);
  if (loading) return <div className="customer-shell product-detail-page"><div className="product-detail-skeleton"><i /><div><i /><i /><i /><i /></div></div></div>;
  if (!product || product.status !== 'ACTIVE') return <div className="customer-shell product-detail-fallback"><span className="section-eyebrow">SẢN PHẨM MUADEE</span><h1>Sản phẩm không còn được bán</h1><p>Sản phẩm này hiện không khả dụng tại Muadee. Bạn có thể tiếp tục xem các sản phẩm khác.</p><Link to="/"><ArrowRight size={17} />Về trang chủ</Link></div>;

  return <div className="customer-shell product-detail-page">
    <Breadcrumb items={[{ label: product.categoryName, to: `/products?categoryId=${product.categoryId}` }, { label: product.productName }]} />
    <section className="product-detail-main">
      <ProductGallery images={[product.image]} name={product.productName} />
      <div className="product-detail-info"><span className="section-eyebrow">{product.categoryName}</span><h1>{product.productName}</h1><div className="product-detail-rating"><Star size={16} fill="currentColor" /><strong>{product.avgRating.toFixed(1).replace('.', ',')}</strong><a href="#product-reviews" onClick={() => setActiveTab('reviews')}>({product.reviewCount.toLocaleString('vi-VN')} đánh giá)</a></div>
        <div className="product-detail-price"><strong>{formatMoney(price)}<small>/{product.unit}</small></strong>{saleActive && <><del>{formatMoney(product.price)}/{product.unit}</del><span>-{discount}%</span></>}</div>
        <div className={`stock-label ${soldOut ? 'out' : product.stock <= 10 ? 'low' : 'available'}`}>{soldOut ? 'Hết hàng' : product.stock <= 10 ? `Sắp hết · Còn ${product.stock} ${product.unit}` : 'Còn hàng'}</div>
        <div className="product-store-line"><span><MapPin size={16} />{storeName}</span><button type="button" onClick={() => window.dispatchEvent(new Event('muadee:open-store-selector'))}>Đổi cửa hàng</button></div>
        <p className="product-short-description">{product.description || `Sản phẩm ${product.productName} được Muadee tuyển chọn, đảm bảo chất lượng tươi ngon cho bữa ăn gia đình.`}</p>
        <div className="product-detail-buy"><label>Số lượng</label><QuantitySelector quantity={quantity} stock={product.stock} unit={product.unit} disabled={soldOut} onChange={setQuantity} /><strong>Tạm tính: {formatMoney(price * quantity)}</strong></div>
        {product.unit === 'kg' && <p className="product-weight-note">Hàng bán theo cân: khối lượng thực tế có thể chênh lệch nhẹ, tiền được tính lại khi cân.</p>}
        <div className="product-detail-actions"><button className="product-add-button" type="button" disabled={soldOut || adding} onClick={() => void submitCart('add')}><ShoppingBasket size={17} />{soldOut ? 'Hết hàng' : adding ? 'Đang thêm...' : 'Thêm vào giỏ'}</button><button className="product-buy-button" type="button" disabled={soldOut || adding} onClick={() => void submitCart('buy')}>Mua ngay <ArrowRight size={17} /></button></div>
        {tabAction === 'buy' && <span className="visually-hidden" aria-live="polite">Bạn cần đăng nhập để tiếp tục mua ngay.</span>}
      </div>
    </section>
    <section className="product-detail-tabs"><div className="product-tab-list" role="tablist" aria-label="Thông tin sản phẩm">{([['description', 'Mô tả'], ['reviews', 'Đánh giá'], ['policy', 'Chính sách giao nhận và đổi trả']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={activeTab === key ? 'selected' : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</div><div className="product-tab-content" id="product-reviews" role="tabpanel">{activeTab === 'description' ? <p>{product.description || `Khám phá ${product.productName} được tuyển chọn kỹ lưỡng tại Muadee. Sản phẩm được bảo quản đúng cách để giữ trọn độ tươi ngon.`}</p> : activeTab === 'reviews' ? <ReviewList product={product} /> : <div className="product-policy"><h3>Giao nhận</h3><p>Đặt hàng giao tận nơi hoặc nhận tại cửa hàng. Phí giao hàng được tính theo địa chỉ và hiển thị trước khi xác nhận đơn.</p><h3>Đổi trả</h3><p>Liên hệ chăm sóc khách hàng trong vòng 24 giờ nếu sản phẩm không đảm bảo chất lượng. Muadee sẽ hỗ trợ kiểm tra và xử lý phù hợp.</p></div>}</div></section>
    <RecommendationSection id="product-recommendations" title="Thường mua cùng" eyebrow="KẾT HỢP THÀNH MÓN NGON" products={recommendations.slice(0, 4)} loading={false} onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} />
    <RecommendationSection title="Có thể bạn quan tâm" eyebrow="GỢI Ý DÀNH CHO BẠN" products={recommendations.slice(4, 8)} loading={false} onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} />
  </div>;
}