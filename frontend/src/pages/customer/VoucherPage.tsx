import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tag } from 'lucide-react';
import { vouchersApi } from '../../api/vouchers';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { VoucherCard } from '../../components/voucher/VoucherCard';
import type { Voucher } from '../../types/voucher';
import { useAuth } from '../../store/AuthContext';

export default function VoucherPage() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'active' | 'expiring'>('active');

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') { setLoading(false); return; }
    let active = true;
    setLoading(true);
    vouchersApi.available().then((items) => { if (active) setVouchers(items); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  const categorized = useMemo(() => {
    const now = Date.now();
    const valid = vouchers.filter((voucher) => Date.parse(voucher.startDate) <= now && Date.parse(voucher.endDate) >= now);
    return {
      active: valid.filter((voucher) => Date.parse(voucher.endDate) - now >= 3 * 24 * 60 * 60 * 1000),
      expiring: valid.filter((voucher) => Date.parse(voucher.endDate) - now < 3 * 24 * 60 * 60 * 1000),
    };
  }, [vouchers]);
  const displayed = categorized[tab];
  const returnTo = '/profile/vouchers';

  if (!user || user.role !== 'CUSTOMER') return <div className="customer-shell voucher-page">
    <Breadcrumb items={[{ label: 'Voucher của tôi' }]} />
    <section className="voucher-login-state"><span><Tag size={25} /></span><h1>Đăng nhập để xem voucher</h1><p>Đăng nhập thành viên để xem những ưu đãi đang dành cho bạn.</p><div><Link className="primary-button" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập <ArrowRight size={15} /></Link><Link className="secondary-button" to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Đăng ký</Link></div></section>
  </div>;

  return <div className="customer-shell voucher-page">
    <Breadcrumb items={[{ label: 'Voucher của tôi' }]} />
    <header className="listing-heading"><span className="section-eyebrow">ƯU ĐÃI THÀNH VIÊN</span><h1>Voucher của tôi</h1><p>Mã giảm giá đang áp dụng cho những lần mua sắm tiếp theo.</p></header>
    <div className="voucher-tabs" role="tablist" aria-label="Lọc voucher"><button id="voucher-tab-active" role="tab" type="button" aria-selected={tab === 'active'} aria-controls="voucher-panel" className={tab === 'active' ? 'selected' : ''} onClick={() => setTab('active')}>Đang áp dụng <span>{categorized.active.length}</span></button><button id="voucher-tab-expiring" role="tab" type="button" aria-selected={tab === 'expiring'} aria-controls="voucher-panel" className={tab === 'expiring' ? 'selected' : ''} onClick={() => setTab('expiring')}>Sắp hết hạn <span>{categorized.expiring.length}</span></button></div>
    <section className="voucher-list" id="voucher-panel" role="tabpanel" aria-labelledby={tab === 'active' ? 'voucher-tab-active' : 'voucher-tab-expiring'}>
      {loading ? <div className="voucher-loading" aria-label="Đang tải voucher"><i /><i /></div> : error ? <div className="listing-message listing-error" role="alert"><strong>Không tải được voucher</strong><p>Đã có lỗi khi kết nối. Vui lòng tải lại trang.</p><button type="button" onClick={() => window.location.reload()}>Thử lại</button></div> : displayed.length ? displayed.map((voucher) => <VoucherCard key={voucher.voucherId} voucher={voucher} expiring={tab === 'expiring'} />) : <div className="voucher-empty"><Tag size={25} /><p>Hiện chưa có voucher nào. Hãy quay lại sau nhé!</p></div>}
    </section>
  </div>;
}