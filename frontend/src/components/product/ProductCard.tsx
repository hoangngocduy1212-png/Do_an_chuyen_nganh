import { useEffect, useState } from 'react';
import { Heart, Minus, Plus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { activitiesApi } from '../../api/activities';
import { cartApi } from '../../api/cart';
import type { Product } from '../../types/product';
import { useAuth } from '../../store/AuthContext';
import { cartStore } from '../../store/cartStore';
import { ProductImage } from './ProductImage';
import { useStoreSelection } from '../../store/storeSelectionStore';

export function ProductCard({ product, onLoginRequired, rank, showDeal = false }: { product: Product; onLoginRequired: (product: Product) => void; rank?: number; showDeal?: boolean }) {
  const { user } = useAuth();
  const { storeId } = useStoreSelection();
  const [quantity, setQuantity] = useState(product.unit === 'kg' ? 0.5 : 1);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saleActive = Boolean(showDeal && product.salePrice && product.saleEndDate && Date.parse(product.saleEndDate) >= now);
  const displayedPrice = saleActive ? product.salePrice as number : product.price;
  const discount = saleActive ? Math.round((1 - displayedPrice / product.price) * 100) : 0;
  const saleEnd = product.saleEndDate ? new Date(product.saleEndDate) : null;
  const hoursLeft = saleEnd ? (saleEnd.getTime() - now) / 3_600_000 : Number.POSITIVE_INFINITY;
  const expiryLabel = saleEnd && hoursLeft < 24 && hoursLeft > 0
    ? `Kết thúc ${Math.max(1, Math.ceil(hoursLeft))} giờ nữa`
    : saleEnd ? `Kết thúc ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(saleEnd)}` : '';

  useEffect(() => {
    if (!saleEnd || hoursLeft >= 24 || hoursLeft <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [product.saleEndDate, hoursLeft, saleEnd]);

  if (product.status !== 'ACTIVE') return null;

  const soldOut = product.stock <= 0;
  const stockLabel = soldOut ? 'Hết hàng' : product.stock <= 10 ? 'Sắp hết' : 'Còn hàng';
  const step = product.unit === 'kg' ? 0.5 : 1;

  async function addToCart() {
    if (soldOut || adding) return;
    if (!user) { onLoginRequired(product); return; }
    setAdding(true);
    try {
      await cartApi.add(product.productId, quantity, storeId);
      cartStore.add(product, quantity);
      activitiesApi.record('ADD_TO_CART', product.productId).catch(() => undefined);
      window.dispatchEvent(new Event('muadee:cart-added'));
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã thêm vào giỏ hàng' }));
    } catch { /* The cart remains unchanged when the server rejects the request. */ }
    finally { setAdding(false); }
  }

  return (
    <article className={`product-card ${soldOut ? 'sold-out' : ''}`}>
      <div className="product-card-visual">
        <Link to={`/products/${product.productId}`} aria-label={`Xem ${product.productName}`} onClick={() => activitiesApi.record('VIEW', product.productId).catch(() => undefined)}><ProductImage src={product.image} alt={product.productName} /></Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {rank && <span className="product-rank-badge">Top {rank}</span>}
        {saleActive && <span className="product-discount-badge">-{discount}%</span>}
        <button className="icon-button product-favorite" type="button" aria-label="Yêu thích sản phẩm"><Heart size={17} /></button>
      </div>
      <div className="product-card-content">
        <span className="product-category">{product.categoryName}</span>
        <h3><Link to={`/products/${product.productId}`} onClick={() => activitiesApi.record('VIEW', product.productId).catch(() => undefined)}>{product.productName}</Link></h3>
        <div className="product-rating"><Star size={14} fill="currentColor" /><span>{product.avgRating.toFixed(1).replace('.', ',')}</span><span className="muted">({product.reviewCount})</span></div>
        <span className={`stock-label ${soldOut ? 'out' : product.stock <= 10 ? 'low' : 'available'}`}>{stockLabel}</span>
        <div className="product-buy-row">
          <div><strong className={saleActive ? 'sale-price' : ''}>{displayedPrice.toLocaleString('vi-VN')}đ/{product.unit}</strong>{saleActive && <del>{product.price.toLocaleString('vi-VN')}đ/{product.unit}</del>}{!saleActive && product.originalPrice && <del>{product.originalPrice.toLocaleString('vi-VN')}đ/{product.unit}</del>}</div>
          <div className="quantity-stepper" aria-label={`Số lượng ${quantity} ${product.unit}`}><button type="button" aria-label="Giảm số lượng" disabled={soldOut || quantity <= step} onClick={() => setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))}><Minus size={13} /></button><span>{Number.isInteger(quantity) ? quantity : quantity.toLocaleString('vi-VN')}</span><button type="button" aria-label="Tăng số lượng" disabled={soldOut || quantity + step > product.stock} onClick={() => setQuantity((value) => Number((value + step).toFixed(2)))}><Plus size={13} /></button></div>
        </div>
        {product.unit === 'kg' && <p className="weight-note">Khối lượng thực tế có thể chênh lệch nhẹ, giá được tính lại khi cân</p>}
        {saleActive && <p className="sale-expiry">{expiryLabel}</p>}
        <button className="add-cart-full" type="button" disabled={soldOut || adding} onClick={addToCart}>{soldOut ? 'Hết hàng' : adding ? 'Đang thêm...' : 'Thêm vào giỏ'}</button>
      </div>
    </article>
  );
}