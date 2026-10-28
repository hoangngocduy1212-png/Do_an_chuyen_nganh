import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquareText, PackageCheck, RotateCw } from 'lucide-react';
import { reviewsApi } from '../../../api/reviews';
import type { CustomerReview } from '../../../types/review';
import { ReviewForm } from '../../../components/account/ReviewForm';
import { StarRating } from '../../../components/account/StarRating';
import { ProductImage } from '../../../components/product/ProductImage';

export default function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'done' ? 'done' : 'pending';
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  async function load(nextTab: 'pending' | 'done' = tab) { setLoading(true); setLoadError(false); try { setReviews(await reviewsApi.mine(nextTab)); } catch { setLoadError(true); } finally { setLoading(false); } }
  useEffect(() => { void load(tab); }, [tab]);
  const visible = reviews;
  async function send(review: CustomerReview, rating: number, comment: string) { await reviewsApi.create({ orderId: review.orderId, productId: review.productId, rating, comment }); setSelected(null); setParams({ tab: 'done' }); window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Cảm ơn bạn đã đánh giá' })); }
  return <section className="account-panel"><header className="account-panel-heading"><div><span className="section-eyebrow">CHIA SẺ TRẢI NGHIỆM</span><h2>Đánh giá của tôi</h2></div></header>
    <div className="account-tabs" role="tablist" aria-label="Lọc đánh giá"><button role="tab" aria-selected={tab === 'pending'} className={tab === 'pending' ? 'selected' : ''} type="button" onClick={() => { setSelected(null); setParams({ tab: 'pending' }); }}>Chờ đánh giá</button><button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'selected' : ''} type="button" onClick={() => { setSelected(null); setParams({ tab: 'done' }); }}>Đã đánh giá</button></div>
    {loading ? <div className="account-skeleton" aria-label="Đang tải đánh giá"><i /><i /></div> : loadError ? <div className="account-error" role="alert"><span>Không tải được dữ liệu</span><button type="button" onClick={() => void load()}><RotateCw size={14} /> Thử lại</button></div> : visible.length ? <div className="review-list">{visible.map((review) => <article className="customer-review-row" key={review.reviewId}><ProductImage src={review.productImage} alt="Sản phẩm đã mua" /><div className="review-product-copy"><strong>{review.productName}</strong><small>Mã đơn #{review.orderId}</small>{tab === 'pending' && review.deliveredAt && <small>Giao ngày {new Date(review.deliveredAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</small>}{tab === 'done' && <><StarRating value={review.rating ?? 0} readOnly /><p>{review.comment}</p><small>Đánh giá ngày {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Đang cập nhật'}</small></>}</div>{tab === 'pending' && <button className="account-outline-button" type="button" onClick={() => setSelected(selected === review.reviewId ? null : review.reviewId)}><MessageSquareText size={15} /> Viết đánh giá</button>}{selected === review.reviewId && <div className="review-form-wrap"><ReviewForm onSubmit={(rating, comment) => send(review, rating, comment)} onCancel={() => setSelected(null)} /></div>}</article>)}</div> : <div className="account-empty"><MessageSquareText size={26} /><p>{tab === 'pending' ? 'Không có sản phẩm nào chờ đánh giá' : 'Bạn chưa có đánh giá nào'}</p></div>}
  </section>;
}