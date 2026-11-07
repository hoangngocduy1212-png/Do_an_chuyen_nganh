import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { productsApi } from '../../api/products';
import { staffApi, type Paged, type StaffReview } from '../../api/staff';
import { formatDate, Heading, Pager, useLabels } from './shared';

const LIMIT = 20;

export default function StaffReviewsPage() {
  const [data, setData] = useState<Paged<StaffReview>>({ items: [], total: 0, page: 1, limit: LIMIT });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await staffApi.reviews({ page, limit: LIMIT }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { void load(); }, [load]);

  const productName = useLabels(data.items.map((review) => review.productId), async (id) => (await productsApi.adminGet(id)).productName);

  async function toggle(review: StaffReview) {
    try {
      await staffApi.setReviewHidden(review.reviewId, !review.isHidden);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="staff-page">
      <Heading eyebrow="KIỂM DUYỆT" title="Đánh giá sản phẩm" />
      {error && <p className="staff-error" role="alert">{error}</p>}
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Sản phẩm</th><th>Sao</th><th>Nhận xét</th><th>Ngày</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="staff-state">Đang tải...</td></tr>
              : data.items.length === 0 ? <tr><td colSpan={6} className="staff-state">Chưa có đánh giá</td></tr>
              : data.items.map((review) => (
                <tr key={review.reviewId}>
                  <td>{productName(review.productId)}</td>
                  <td>{'★'.repeat(review.rating)}</td>
                  <td>{review.comment || '—'}</td>
                  <td>{formatDate(review.createdAt)}</td>
                  <td><span className={`staff-badge ${review.isHidden ? 'bad' : 'ok'}`}>{review.isHidden ? 'Đã ẩn' : 'Hiển thị'}</span></td>
                  <td><button className="staff-btn secondary" type="button" onClick={() => void toggle(review)}>{review.isHidden ? 'Hiện lại' : 'Ẩn'}</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} limit={LIMIT} total={data.total} onChange={setPage} />
    </section>
  );
}
