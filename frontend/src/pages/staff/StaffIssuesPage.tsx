import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { staffApi, type IssueType, type OrderIssue, type Paged } from '../../api/staff';
import { formatDate, Heading, Pager, useLabels } from './shared';

const LIMIT = 20;
const labels: Record<IssueType, string> = { OUT_OF_STOCK: 'Hết hàng', INVALID_INFORMATION: 'Sai thông tin', OTHER: 'Khác' };

export default function StaffIssuesPage() {
  const [data, setData] = useState<Paged<OrderIssue>>({ items: [], total: 0, page: 1, limit: LIMIT });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await staffApi.issues({ page, limit: LIMIT }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { void load(); }, [load]);

  const orderCode = useLabels(data.items.map((issue) => issue.orderId), async (id) => (await staffApi.order(id)).orderCode);

  async function resolve(id: string) {
    try {
      await staffApi.resolveIssue(id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="staff-page">
      <Heading eyebrow="PHẢN ÁNH ĐƠN HÀNG" title="Vấn đề phát sinh" />
      {error && <p className="staff-error" role="alert">{error}</p>}
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Đơn</th><th>Loại</th><th>Chi tiết</th><th>Trạng thái</th><th>Tạo lúc</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="staff-state">Đang tải...</td></tr>
              : data.items.length === 0 ? <tr><td colSpan={6} className="staff-state">Chưa có phản ánh</td></tr>
              : data.items.map((issue) => (
                <tr key={issue.issueId}>
                  <td>{orderCode(issue.orderId)}</td>
                  <td>{labels[issue.type] ?? issue.type}</td>
                  <td>{issue.detail}</td>
                  <td><span className={`staff-badge ${issue.status === 'OPEN' ? 'warn' : 'ok'}`}>{issue.status === 'OPEN' ? 'Đang mở' : 'Đã xử lý'}</span></td>
                  <td>{formatDate(issue.createdAt)}</td>
                  <td>{issue.status === 'OPEN' && <button className="staff-btn" type="button" onClick={() => void resolve(issue.issueId)}>Đánh dấu đã xử lý</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} limit={LIMIT} total={data.total} onChange={setPage} />
    </section>
  );
}
