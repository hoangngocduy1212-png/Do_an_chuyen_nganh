import { ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProductCard } from '../product/ProductCard';
import type { Product } from '../../types/product';
import { useAuth } from '../../store/AuthContext';

export function RecommendationSection({ id, title, eyebrow = 'ĐƯỢC CHỌN CHO BẠN', products, loading, onLoginRequired, onFeedback, showFeedback = false, inStockOnly = false }: { id?: string; title: string; eyebrow?: string; products: Product[]; loading: boolean; onLoginRequired: (product: Product) => void; onFeedback?: (isHelpful: boolean) => void; showFeedback?: boolean; inStockOnly?: boolean }) {
  const { user } = useAuth();
  const availableProducts = products.filter((product) => product.status === 'ACTIVE' && (!inStockOnly || product.stock > 0));
  return <motion.section className="fresh-section" id={id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .36, ease: 'easeOut' }}><div className="section-heading"><div><span className="section-eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="recommendation-actions">{showFeedback && user?.role === 'CUSTOMER' && <div className="recommendation-feedback"><span>Gợi ý này có hữu ích không?</span><button type="button" aria-label="Gợi ý hữu ích" onClick={() => onFeedback?.(true)}><ThumbsUp size={15} /></button><button type="button" aria-label="Gợi ý chưa hữu ích" onClick={() => onFeedback?.(false)}><ThumbsDown size={15} /></button></div>}<Link to="/products" className="text-link">Xem tất cả <ArrowRight size={17} /></Link></div></div>
    <div className="product-grid">{loading ? Array.from({ length: 4 }, (_, index) => <motion.div className="product-skeleton" key={index} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .3, delay: index * .08 }}><div /><span /><span /></motion.div>) : availableProducts.map((product, index) => <motion.div key={product.productId} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: .3, delay: index * .08 }}><ProductCard product={product} onLoginRequired={onLoginRequired} /></motion.div>)}</div>
    {!loading && availableProducts.length === 0 && <div className="empty-products"><p>Chưa có sản phẩm phù hợp tại cửa hàng này</p><button type="button" onClick={() => window.dispatchEvent(new Event('muadee:open-store-selector'))}>Đổi cửa hàng</button></div>}
  </motion.section>;
}