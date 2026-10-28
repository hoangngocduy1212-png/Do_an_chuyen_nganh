import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, Bot, ChevronRight, Clock3, Leaf, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { categoriesApi } from '../../../api/categories';
import { productsApi } from '../../../api/products';
import { recommendationsApi } from '../../../api/recommendations';
import { storesApi } from '../../../api/stores';
import { aiFeedbackApi } from '../../../api/aiFeedback';
import { cartApi } from '../../../api/cart';
import { activitiesApi } from '../../../api/activities';
import { homeVoucher } from '../../../api/mock/data';
import { RecommendationSection } from '../../../components/recommendation/RecommendationSection';
import type { Category } from '../../../types';
import type { Product } from '../../../types/product';
import type { StoreLocation } from '../../../types/store';
import { useAuth } from '../../../store/AuthContext';
import { cartStore } from '../../../store/cartStore';
import { useStoreSelection } from '../../../store/storeSelectionStore';

const dishShortcuts = [
  { title: 'Rau xanh mỗi ngày', subtitle: 'Tươi mát, đủ chất', category: 'rau-cu', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=320&q=85' },
  { title: 'Trái cây theo mùa', subtitle: 'Ngọt lành tự nhiên', category: 'trai-cay', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=320&q=85' },
  { title: 'Bữa ngon đủ đạm', subtitle: 'Tươi ngon chọn lọc', category: 'thit-ca', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=320&q=85' },
  { title: 'Bữa sáng dinh dưỡng', subtitle: 'Khởi đầu tràn năng lượng', category: 'sua-trung', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=320&q=85' },
];

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [freshProducts, setFreshProducts] = useState<Product[]>([]);
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [coldStart, setColdStart] = useState(true);
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const { storeId } = useStoreSelection();
  const { user } = useAuth();

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([])).finally(() => setCategoriesLoading(false));
    storesApi.list().then(setStores).catch(() => setStores([]));
  }, []);
  useEffect(() => {
    let active = true;
    setLoadingProducts(true);
    setLoadingRecommendations(true);
    Promise.all([productsApi.list({ storeId }), productsApi.list({ storeId, sort: 'best-selling', limit: 4 }).catch(() => [])]).then(([available, popular]) => {
      if (!active) return;
      setFreshProducts(available);
      setLoadingProducts(false);
      setLoadingRecommendations(true);
      return recommendationsApi.home(storeId, user?.role === 'CUSTOMER' ? user.userId : undefined, popular.length ? popular : available).then((result) => {
        if (!active) return;
        setPersonalizedProducts(result.personalized);
        setBestSellers(result.bestSellers);
        setColdStart(result.coldStart);
      });
    }).catch(() => {
      if (active) { setFreshProducts([]); setPersonalizedProducts([]); setBestSellers([]); setLoadingProducts(false); setColdStart(true); }
    }).finally(() => { if (active) { setLoadingProducts(false); setLoadingRecommendations(false); } });
    return () => { active = false; };
  }, [storeId, user?.role, user?.userId]);
  useEffect(() => {
    if (!copiedVoucher) return;
    const timer = window.setTimeout(() => setCopiedVoucher(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedVoucher]);

  useEffect(() => {
    const pendingProductId = localStorage.getItem('muadee-pending-cart-product');
    if (!user || !pendingProductId || loadingProducts) return;
    const product = freshProducts.find((item) => item.productId === pendingProductId);
    if (product) {
      cartApi.add(product.productId, 1, storeId).then(() => {
        cartStore.add(product);
        activitiesApi.record('ADD_TO_CART', product.productId).catch(() => undefined);
        window.dispatchEvent(new Event('muadee:cart-added'));
        window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã thêm vào giỏ hàng' }));
      }).catch(() => undefined);
    }
    localStorage.removeItem('muadee-pending-cart-product');
  }, [user, freshProducts, loadingProducts]);

  function loginRequired(product: Product) {
    localStorage.setItem('muadee-pending-cart-product', product.productId);
    window.dispatchEvent(new Event('muadee:login-required'));
  }

  function openChat() {
    window.dispatchEvent(new Event('muadee:close-store-selector'));
    window.dispatchEvent(new Event('muadee:open-chat'));
  }

  async function copyVoucher() {
    try {
      await navigator.clipboard.writeText(homeVoucher.code);
    } catch {
      const field = document.createElement('textarea');
      field.value = homeVoucher.code;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopiedVoucher(true);
  }

  function submitRecommendationFeedback(isHelpful: boolean) {
    aiFeedbackApi.send({ feedbackType: 'RECOMMENDATION', isHelpful }).catch(() => undefined);
  }

  const selectedStoreName = stores.find((store) => store._id === storeId)?.name ?? 'cửa hàng gần bạn';

  return <div className="customer-shell home-content">
    <motion.section className="home-hero" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .38, ease: 'easeOut' }}>
      <div className="hero-copy"><span className="hero-eyebrow"><Leaf size={15} /> TƯƠI NGON MỖI NGÀY</span><h1>Một giỏ tươi xanh,<br />cả nhà ngon lành.</h1><p>Thực phẩm tươi ngon được chọn lựa mỗi ngày, giao đến căn bếp nhà bạn.</p><button className="hero-cta" type="button" onClick={() => document.getElementById('fresh-today')?.scrollIntoView({ behavior: 'smooth' })}>Khám phá ngay <ArrowDown size={17} /></button><div className="hero-proof"><span><ShieldCheck size={16} /> Chọn lọc mỗi ngày</span><i /><span><Clock3 size={15} /> Tươi ngon đúng hẹn</span></div></div>
      <div className="hero-image" role="img" aria-label="Rau củ quả tươi ngon cho bữa cơm gia đình"><div className="hero-image-note"><span className="hero-leaf-icon"><Leaf size={18} /></span><span><strong>Tươi từ cửa hàng gần bạn</strong><small>Chọn lựa kỹ, giao tận tay</small></span></div></div>
    </motion.section>

    <motion.section className="promo-grid" aria-label="Ưu đãi và trợ lý Muadee" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .36, delay: .08 }}>
      <article className="voucher-promo"><div className="promo-art voucher-art"><Tag size={28} /></div><div className="promo-copy"><span className="promo-label">VOUCHER</span><h2>Ưu đãi thành viên</h2><p>Giảm <strong>{homeVoucher.discountValue.toLocaleString('vi-VN')}đ</strong> cho đơn từ {homeVoucher.minimumOrder.toLocaleString('vi-VN')}đ</p><div className="voucher-meta"><span>Mã <b>{homeVoucher.code}</b></span><span>HSD 30/11/2026</span></div>{user ? <button className="promo-action" type="button" onClick={copyVoucher}>{copiedVoucher ? 'Đã sao chép' : 'Sao chép mã'} <ArrowRight size={15} /></button> : <Link className="promo-action" to={`/login?returnTo=${encodeURIComponent('/')}`}>Đăng nhập để dùng <ArrowRight size={15} /></Link>}</div><span className="promo-decoration" /></article>
      <button type="button" className="ai-promo" onClick={openChat}><span className="ai-promo-icon"><Bot size={25} /></span><span className="ai-promo-copy"><span className="promo-label">TRỢ LÝ MUADEE AI</span><strong>Bạn cần tìm món gì?</strong><small>Tư vấn sản phẩm, khuyến mãi và chính sách giao nhận.</small><span className="ai-promo-link">Trò chuyện ngay <ArrowRight size={15} /></span></span><Sparkles className="ai-sparkle" size={19} /></button>
    </motion.section>

    <motion.section className="dish-section" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .36 }}><div className="section-heading compact-heading"><div><span className="section-eyebrow">GỢI Ý BỮA NGON</span><h2>Đi chợ theo món</h2></div><Link to="/products" className="text-link">Xem tất cả <ArrowRight size={17} /></Link></div><div className="dish-grid">{dishShortcuts.map((dish, index) => <motion.div key={dish.category} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .3, delay: index * .08 }}><Link to={`/products?categoryId=${dish.category}`} className="dish-tile" style={{ backgroundImage: `linear-gradient(90deg, rgba(15,42,36,.78), rgba(15,42,36,.12)), url("${dish.image}")` }}><span><strong>{dish.title}</strong><small>{dish.subtitle}</small></span><ChevronRight size={19} /></Link></motion.div>)}</div></motion.section>

    <RecommendationSection id="fresh-today" title="Tươi ngon hôm nay" eyebrow="TƯƠI MỖI NGÀY" products={freshProducts} loading={loadingProducts} onLoginRequired={loginRequired} />
    {user?.role === 'CUSTOMER' && (!coldStart || loadingRecommendations) && <RecommendationSection title="Có thể bạn quan tâm" eyebrow="GỢI Ý DÀNH RIÊNG" products={personalizedProducts} loading={loadingRecommendations} onLoginRequired={loginRequired} onFeedback={submitRecommendationFeedback} showFeedback inStockOnly />}
    <RecommendationSection title={`Bán chạy tại ${selectedStoreName}`} eyebrow="ĐƯỢC NHIỀU KHÁCH CHỌN" products={bestSellers} loading={loadingRecommendations} onLoginRequired={loginRequired} onFeedback={submitRecommendationFeedback} showFeedback inStockOnly />
    <motion.section className="category-strip" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .36 }}><div><span className="section-eyebrow">KHÁM PHÁ GIAN HÀNG</span><h2>Mua sắm theo danh mục</h2></div><div className="category-pills">{categoriesLoading ? <div className="category-pills-skeleton" aria-label="Đang tải danh mục"><i /><i /><i /><i /></div> : categories.length ? categories.map((category, index) => <motion.div key={category._id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .28, delay: index * .08 }}><Link to={`/products?categoryId=${category._id}`}>{category.categoryName}<ArrowRight size={14} /></Link></motion.div>) : <p className="category-empty">Danh mục đang được cập nhật. Bạn có thể xem tất cả sản phẩm.</p>}</div></motion.section>
    <div className="home-endmark"><span /><span /></div>
  </div>;
}
