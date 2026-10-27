import { motion, useReducedMotion } from 'framer-motion';
import type { Product } from '../../types/product';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products, loading, error, collection, rankOffset = 0, onLoginRequired, onRetry, onClear, onChangeStore }: {
  products: Product[];
  loading: boolean;
  error: boolean;
  collection?: string;
  rankOffset?: number;
  onLoginRequired: (product: Product) => void;
  onRetry: () => void;
  onClear: () => void;
  onChangeStore: () => void;
}) {
  const reduceMotion = useReducedMotion();
  if (error) return <div className="listing-message listing-error" role="alert"><strong>Không tải được sản phẩm</strong><p>Đã có lỗi khi kết nối. Vui lòng thử lại.</p><button type="button" onClick={onRetry}>Thử lại</button></div>;
  if (loading) return <div className="product-grid" aria-label="Đang tải sản phẩm" aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><span /></div>)}</div>;
  if (!products.length) return <div className="empty-products"><p>Chưa có sản phẩm phù hợp tại cửa hàng này</p><div><button type="button" onClick={onClear}>Xóa bộ lọc</button><button type="button" className="secondary" onClick={onChangeStore}>Đổi cửa hàng</button></div></div>;
  return <motion.div className="product-grid" layout={!reduceMotion} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .22 }}>
    {products.map((product, index) => <motion.div className="product-grid-item" key={product.productId} layout={!reduceMotion} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, delay: reduceMotion ? 0 : index * .05, ease: 'easeOut' }}>
      <ProductCard product={product} onLoginRequired={onLoginRequired} rank={collection === 'bestseller' && rankOffset + index < 3 ? rankOffset + index + 1 : undefined} showDeal={collection === 'deals'} />
    </motion.div>)}
  </motion.div>;
}