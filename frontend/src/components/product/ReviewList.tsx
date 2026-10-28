import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { reviewsApi } from '../../api/reviews';
import { useStoreSelection } from '../../store/storeSelectionStore';
import type { Product } from '../../types/product';

function maskName(name: string) {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return second ? `${first} ${second.slice(0, 1)}***` : `${first.slice(0, 1)}***`;
}

export function ReviewList({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Awaited<ReturnType<typeof reviewsApi.product>>['items']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    reviewsApi.product(product.productId, page).then((result) => { if (active) { setItems(result.items); setTotal(result.total); } }).catch(() => { if (active) { setItems([]); setTotal(0); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product.productId, page]);
  return <section className="review-panel" aria-labelledby="review-heading">
    <div className="review-overview"><div><strong>{product.avgRating.toFixed(1).replace('.', ',')}</strong><span><Star size={16} fill="currentColor" /> {product.reviewCount.toLocaleString('vi-VN')} đánh giá</span></div><div className="review-distribution">{[5, 4, 3, 2, 1].map((rating) => <div key={rating}><span>{rating} sao</span><i><b style={{ width: `${rating === 5 ? Math.round(product.avgRating / 5 * 100) : Math.max(0, 100 - (5 - rating) * 22)}%` }} /></i><span>{rating === 5 ? Math.round(product.reviewCount * .7) : Math.round(product.reviewCount * .075)}</span></div>)}</div></div>
    <div><h3 id="review-heading">Đánh giá của khách hàng</h3>{loading ? <div className="review-loading" aria-label="Đang tải đánh giá" /> : items.length ? items.map((review) => <article className="review-item" key={review.reviewId}><div className="review-item-head"><strong>{maskName(review.userName)}</strong><span>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < review.rating ? 'currentColor' : 'none'} />)}</span><time>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</time></div><p>{review.comment}</p></article>) : <p className="review-empty">Chưa có đánh giá cho sản phẩm này.</p>}{total > 5 && <button className="review-more" type="button" disabled={loading || page * 5 >= total} onClick={() => setPage((value) => value + 1)}>Xem thêm đánh giá</button>}</div>
  </section>;
}