import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { ProductImage } from '../product/ProductImage';
import { QuantitySelector } from '../product/QuantitySelector';
import { formatMoney } from '../../utils/money';
import type { CartItem } from '../../types/cart';

export function CartItemRow({ item, onQuantity, onRemove }: { item: CartItem; onQuantity: (quantity: number) => void; onRemove: () => void }) {
  const [quantity, setQuantity] = useState(item.quantity);
  const lastSent = useRef(item.quantity);
  useEffect(() => setQuantity(item.quantity), [item.quantity]);
  useEffect(() => {
    if (quantity === item.quantity || quantity === lastSent.current) return;
    const timer = window.setTimeout(() => { lastSent.current = quantity; onQuantity(quantity); }, 400);
    return () => window.clearTimeout(timer);
  }, [quantity, item.quantity, onQuantity]);
  const soldOut = item.stock === 0;
  const price = item.product.salePrice ?? item.product.price;
  return <article className={`cart-item-row ${soldOut ? 'unavailable' : ''}`}>
    <Link className="cart-item-image" to={`/products/${item.product.productId}`}><ProductImage src={item.product.image} alt={item.product.productName} /></Link>
    <div className="cart-item-info"><Link to={`/products/${item.product.productId}`}><strong>{item.product.productName}</strong></Link><span>{formatMoney(price)}/{item.product.unit}</span>{soldOut ? <small className="cart-line-alert">Sản phẩm đã hết tại cửa hàng này</small> : item.quantity > (item.stock ?? Infinity) ? <small className="cart-line-alert">Chỉ còn {item.stock}, đã điều chỉnh số lượng</small> : item.priceAtAdd && item.priceAtAdd !== price ? <small className="cart-line-alert">Giá đã thay đổi từ {formatMoney(item.priceAtAdd)} thành {formatMoney(price)}</small> : null}
      {item.product.unit === 'kg' && <small className="cart-weight-label">Bán theo cân</small>}</div>
    <QuantitySelector quantity={quantity} stock={item.stock ?? item.product.stock} unit={item.product.unit} disabled={soldOut} onChange={setQuantity} />
    <strong className="cart-line-total">{formatMoney(price * quantity)}</strong>
    <button className="icon-button cart-remove" type="button" aria-label="Xóa khỏi giỏ" onClick={onRemove}><Trash2 size={17} /></button>
  </article>;
}