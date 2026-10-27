import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, ChevronRight, Clock3, List, Menu, Search, ShoppingBasket, X } from 'lucide-react';
import { AccountMenu } from './AccountMenu';
import { StoreReceiveSelector } from './StoreReceiveSelector';
import { useAuth } from '../../store/AuthContext';
import { useCart } from '../../store/cartStore';
import { activitiesApi } from '../../api/activities';
import { cartApi } from '../../api/cart';
import { categoriesApi } from '../../api/categories';
import type { Category } from '../../types';

const RECENT_SEARCH_KEY = 'muadee-recent-searches';

export function Header({ onOpenChat }: { onOpenChat: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) ?? '[]') as string[]; } catch { return []; } });
  const [showRecent, setShowRecent] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();

  useEffect(() => {
    if (user) cartApi.get().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([])).finally(() => setCategoriesLoading(false));
  }, []);
  useEffect(() => {
    const openLogin = () => setLoginPrompt(true);
    const bumpCart = () => {
      setCartBump(true);
      window.setTimeout(() => setCartBump(false), 350);
    };
    window.addEventListener('muadee:login-required', openLogin);
    window.addEventListener('muadee:cart-added', bumpCart);
    return () => {
      window.removeEventListener('muadee:login-required', openLogin);
      window.removeEventListener('muadee:cart-added', bumpCart);
    };
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 5);
    setRecent(next);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
    activitiesApi.recordSearch(value).catch(() => undefined);
    setShowRecent(false);
    navigate(`/products?q=${encodeURIComponent(value)}`);
  }

  function requireLogin(productId?: string) {
    if (productId) localStorage.setItem('muadee-pending-cart-product', productId);
    setLoginPrompt(true);
  }

  const returnTo = `${location.pathname}${location.search}`;
  const isProducts = location.pathname === '/products';
  const isCollectionActive = (collection: string) => isProducts && new URLSearchParams(location.search).get('collection') === collection;
  const isCategoryActive = (categoryId: string) => isProducts && new URLSearchParams(location.search).get('categoryId') === categoryId;
  const isAllActive = isProducts && !location.search;

  return <>
    <div className="announcement-bar"><div className="customer-shell announcement-inner"><span>Giao tận nơi hoặc đặt trước, nhận tại cửa hàng</span><button type="button" onClick={onOpenChat}><Bot size={15} /> Trợ lý Muadee AI <ArrowRight size={14} /></button></div></div>
    <header className="site-header"><div className="customer-shell header-main">
      <Link to="/" className="muadee-brand" aria-label="Muadee, về trang chủ"><span className="brand-mark"><span /></span><span>muadee<small>tươi ngon mỗi ngày</small></span></Link>
      <StoreReceiveSelector />
      <div className="mobile-header-tools">
        <button className="mobile-icon-button" type="button" aria-label="Tìm kiếm sản phẩm" aria-expanded={mobileSearchOpen} onClick={() => { setMobileSearchOpen((value) => !value); setMobileMenuOpen(false); }}><Search size={21} /></button>
        <button className="cart-trigger mobile-cart-trigger" type="button" aria-label="Giỏ hàng" onClick={() => user ? navigate('/cart') : requireLogin()}><ShoppingBasket size={22} />{cart.length > 0 && <b>{cart.reduce((sum, item) => sum + item.quantity, 0)}</b>}</button>
        <button className="mobile-icon-button" type="button" aria-label="Mở menu" aria-expanded={mobileMenuOpen} onClick={() => { setMobileMenuOpen((value) => !value); setMobileSearchOpen(false); }}><Menu size={21} /></button>
      </div>
      <div className={`search-wrap ${mobileSearchOpen ? 'mobile-search-open' : ''}`}><form className="site-search" onSubmit={search}><Search size={19} /><input value={query} placeholder="Tìm rau củ, trái cây, thực phẩm tươi..." onFocus={() => setShowRecent(true)} onChange={(event) => setQuery(event.target.value)} /><button type="submit">Tìm kiếm</button></form>{showRecent && recent.length > 0 && <div className="recent-searches">{recent.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); navigate(`/products?q=${encodeURIComponent(item)}`); setShowRecent(false); }}><Clock3 size={15} />{item}</button>)}<button className="close-recent" type="button" onClick={() => setShowRecent(false)} aria-label="Đóng lịch sử tìm kiếm"><X size={15} /></button></div>}</div>
      <div className="header-actions">{user ? <AccountMenu user={user} /> : <div className="guest-actions"><Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập</Link><Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Đăng ký</Link></div>}<button type="button" className={`cart-trigger ${cartBump ? 'bump' : ''}`} aria-label="Giỏ hàng" onClick={() => user ? navigate('/cart') : requireLogin()}><ShoppingBasket size={23} /><span>Giỏ hàng</span>{cart.length > 0 && <b>{cart.reduce((sum, item) => sum + item.quantity, 0)}</b>}</button></div>
    </div>
    <div className="customer-shell store-subbar"><StoreReceiveSelector /></div>
    {mobileMenuOpen && <div className="mobile-menu-panel"><div className="customer-shell mobile-menu-content">{user ? <AccountMenu user={user} /> : <div className="guest-actions"><Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập</Link><Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Đăng ký</Link></div>}<Link className={isCollectionActive('bestseller') ? 'active' : ''} to="/products?collection=bestseller">Hàng bán chạy</Link><Link className={isCollectionActive('deals') ? 'active' : ''} to="/products?collection=deals">Ưu đãi hôm nay</Link><Link className={location.pathname === '/profile/vouchers' ? 'active' : ''} to="/profile/vouchers">Voucher của tôi</Link>{categories.map((category) => <Link className={isCategoryActive(category._id) ? 'active' : ''} key={category._id} to={`/products?categoryId=${category._id}`}>{category.categoryName}</Link>)}</div></div>}
    <nav className="category-bar" aria-label="Danh mục sản phẩm"><div className="customer-shell category-nav"><Link to="/products" className={`category-all ${isAllActive ? 'active' : ''}`}><List size={16} />Tất cả danh mục</Link><Link className={isCollectionActive('bestseller') ? 'active' : ''} to="/products?collection=bestseller">Hàng bán chạy</Link><Link className={isCollectionActive('deals') ? 'active' : ''} to="/products?collection=deals">Ưu đãi hôm nay</Link>{categoriesLoading ? <div className="category-nav-skeleton" aria-label="Đang tải danh mục"><i /><i /><i /></div> : categories.slice(0, 5).map((category) => <Link className={isCategoryActive(category._id) ? 'active' : ''} key={category._id} to={`/products?categoryId=${category._id}`}>{category.categoryName}</Link>)}<Link className={location.pathname === '/profile/vouchers' ? 'active' : ''} to="/profile/vouchers">Voucher của tôi</Link><ChevronRight className="category-next" size={17} /></div></nav>
    </header>
    {loginPrompt && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginPrompt(false); }}><section className="login-prompt" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title"><button type="button" className="icon-button modal-close" aria-label="Đóng" onClick={() => setLoginPrompt(false)}><X size={19} /></button><div className="login-prompt-icon"><ShoppingBasket size={24} /></div><h2 id="login-prompt-title">Vui lòng đăng nhập để thêm vào giỏ hàng</h2><p>Đăng nhập để lưu giỏ hàng và tiếp tục mua sắm tại Muadee.</p><Link className="primary-button" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập</Link><Link className="secondary-button" to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Tạo tài khoản</Link></section></div>}
  </>;
}