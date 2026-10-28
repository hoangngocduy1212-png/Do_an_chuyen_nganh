import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBasket } from 'lucide-react';
import { cartApi, type CartResponse } from '../../api/cart';
import { productsApi } from '../../api/products';
import { recommendationsApi } from '../../api/recommendations';
import { storesApi } from '../../api/stores';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { CartItemRow } from '../../components/cart/CartItemRow';
import { CartSummary } from '../../components/cart/CartSummary';
import { RecommendationSection } from '../../components/recommendation/RecommendationSection';
import { ConfirmDialog } from '../../components/account/ConfirmDialog';
import type { CartItem } from '../../types/cart';
import type { Product } from '../../types/product';
import type { StoreLocation } from '../../types/store';
import { cartStore } from '../../store/cartStore';
import { checkoutStore, useCheckout } from '../../store/checkoutStore';
import { useStoreSelection } from '../../store/storeSelectionStore';
import { formatMoney } from '../../utils/money';

export default function CartPage() {
  const { storeId } = useStoreSelection();
  const checkout = useCheckout();
  const [items, setItems] = useState<CartItem[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const storeName = stores.find((store) => store._id === storeId)?.name ?? 'cửa hàng đang chọn';
  const availableItems = items.filter((item) => (item.stock ?? item.product.stock) > 0);
  const subtotal = availableItems.reduce((sum, item) => sum + (item.product.salePrice ?? item.product.price) * item.quantity, 0);
  const count = availableItems.reduce((sum, item) => sum + item.quantity, 0);
  const weighted = availableItems.some((item) => item.product.unit === 'kg');
  const checkoutEnabled = availableItems.length > 0;

  const loadCart = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const [cart, storeList] = await Promise.all([cartApi.get(storeId), storesApi.list().catch(() => [])]);
      setStores(storeList);
      setItems(cart.items.map((item) => ({ ...item, stock: item.product.stock, priceAtAdd: item.priceAtAdd ?? item.product.price })));
      cartStore.replace(cart.items);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { void loadCart(); }, [loadCart]);
  useEffect(() => {
    if (items.length) return;
    productsApi.list({ storeId }).then((products) => recommendationsApi.product(storeId, products)).then(setSuggestions).catch(() => setSuggestions([]));
  }, [items.length, storeId]);

  const updateQuantity = useCallback(async (item: CartItem, quantity: number) => {
    const previous = items.find((line) => line.itemId === item.itemId)?.quantity ?? item.quantity;
    setItems((current) => current.map((line) => line.itemId === item.itemId ? { ...line, quantity } : line));
    cartStore.update(item.product.productId, quantity);
    try { await cartApi.update(item.itemId, quantity); }
    catch { setItems((current) => current.map((line) => line.itemId === item.itemId ? { ...line, quantity: previous } : line)); cartStore.update(item.product.productId, previous); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể cập nhật số lượng. Vui lòng thử lại.' })); }
  }, [items]);

  async function removeItem(item: CartItem) {
    const previous = items;
    setItems((current) => current.filter((line) => line.itemId !== item.itemId));
    cartStore.remove(item.product.productId);
    try { await cartApi.remove(item.itemId); }
    catch { setItems(previous); cartStore.replace(previous); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể xóa sản phẩm khỏi giỏ.' })); }
  }

  async function clearCart() {
    const previous = items;
    setItems([]); cartStore.clear(); setConfirmClear(false); checkoutStore.clearVoucher();
    try { await cartApi.clear(); }
    catch { setItems(previous); cartStore.replace(previous); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Chưa thể xóa toàn bộ giỏ hàng.' })); }
  }

  const summaryCount = useMemo(() => count, [count]);
  return <div className="customer-shell cart-page">
    <Breadcrumb items={[{ label: 'Giỏ hàng' }]} />
    <header className="cart-page-heading"><div><span className="section-eyebrow">MUA SẮM CỦA BẠN</span><h1>Giỏ hàng</h1><p>Giỏ hàng tại <strong>{storeName}</strong></p></div>{items.length > 0 && <button className="cart-clear-button" type="button" onClick={() => setConfirmClear(true)}>Xóa toàn bộ giỏ</button>}</header>
    {loading ? <div className="cart-loading" aria-label="Đang tải giỏ hàng"><i /><i /><i /></div> : error ? <div className="listing-message" role="alert"><strong>Không tải được giỏ hàng</strong><p>Vui lòng thử tải lại để kiểm tra các sản phẩm.</p><button type="button" onClick={() => void loadCart()}>Thử lại</button></div> : items.length === 0 ? <><section className="cart-empty"><span><ShoppingBasket size={31} /></span><h2>Giỏ hàng của bạn đang trống</h2><p>Chọn những món tươi ngon cho bữa ăn hôm nay.</p><Link to="/products">Tiếp tục mua sắm <ArrowRight size={16} /></Link></section><RecommendationSection title="Có thể bạn quan tâm" eyebrow="GỢI Ý CHO BẠN" products={suggestions} loading={false} onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} /></> : <div className="cart-layout"><section className="cart-items" aria-label="Sản phẩm trong giỏ"><div className="cart-items-heading"><span>Sản phẩm</span><span>Số lượng</span><span>Thành tiền</span></div>{items.map((item) => <CartItemRow key={item.itemId} item={item} onQuantity={(quantity) => void updateQuantity(item, quantity)} onRemove={() => void removeItem(item)} />)}{items.every((item) => (item.stock ?? item.product.stock) <= 0) && <p className="cart-all-unavailable">Sản phẩm trong giỏ đã hết hàng tại cửa hàng này. Hãy đổi cửa hàng hoặc tiếp tục mua sắm.</p>}</section><CartSummary count={summaryCount} subtotal={subtotal} discount={checkout.discountAmount} voucher={checkout.voucherCode ? { code: checkout.voucherCode, discount: checkout.discountAmount } : undefined} weighed={weighted} checkoutEnabled={checkoutEnabled} onVoucher={(code, discount) => checkoutStore.applyVoucher(code, discount)} onRemoveVoucher={() => checkoutStore.clearVoucher()} /></div>}
    <ConfirmDialog open={confirmClear} title="Xóa toàn bộ giỏ hàng?" description="Tất cả sản phẩm trong giỏ sẽ bị xóa." confirmLabel="Xóa giỏ hàng" danger onCancel={() => setConfirmClear(false)} onConfirm={clearCart} />
    {items.length > 0 && <p className="cart-bottom-note">Tổng tạm tính {formatMoney(subtotal)} trước khi áp dụng phí vận chuyển.</p>}
  </div>;
}