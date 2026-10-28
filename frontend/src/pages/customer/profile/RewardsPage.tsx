import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Coins, RotateCw, TicketPercent } from 'lucide-react';
import { membershipsApi } from '../../../api/memberships';
import { vouchersApi } from '../../../api/vouchers';
import { MembershipCard } from '../../../components/account/MembershipCard';
import { VoucherCard } from '../../../components/voucher/VoucherCard';
import type { MembershipSummary } from '../../../types/user';
import type { PointHistoryItem } from '../../../types/membership';
import type { Voucher } from '../../../types/voucher';

type Tab = 'vouchers' | 'points';
export default function RewardsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tab: Tab = params.get('tab') === 'points' ? 'points' : 'vouchers';
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    Promise.all([membershipsApi.me(), membershipsApi.transactions(1, 10), vouchersApi.available()]).then(([member, transactions, available]) => { if (active) { setMembership(member); setHistory(transactions.items); setHistoryPage(transactions.page); setHistoryTotal(transactions.total); setVouchers(available); } }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function retryLoad() {
    setLoading(true); setLoadError(false);
    try { const [member, transactions, available] = await Promise.all([membershipsApi.me(), membershipsApi.transactions(1, 10), vouchersApi.available()]); setMembership(member); setHistory(transactions.items); setHistoryPage(transactions.page); setHistoryTotal(transactions.total); setVouchers(available); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  async function loadTransactions(page: number) {
    setLoading(true);
    setLoadError(false);
    try { const result = await membershipsApi.transactions(page, 10); setHistory(result.items); setHistoryPage(result.page); setHistoryTotal(result.total); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  const categorizedVouchers = useMemo(() => {
    const now = Date.now();
    const valid = vouchers.filter((voucher) => Date.parse(voucher.startDate) <= now && Date.parse(voucher.endDate) >= now);
    return {
      active: valid.filter((voucher) => Date.parse(voucher.endDate) - now >= 3 * 24 * 60 * 60 * 1000),
      expiring: valid.filter((voucher) => Date.parse(voucher.endDate) - now < 3 * 24 * 60 * 60 * 1000),
    };
  }, [vouchers]);
  const [voucherTab, setVoucherTab] = useState<'active' | 'expiring'>('active');
  const currentVouchers = categorizedVouchers[voucherTab];
  return <div className="account-page-stack"><header className="account-panel rewards-heading"><div><span className="section-eyebrow">QUYỀN LỢI THÀNH VIÊN</span><h2>Ưu đãi & điểm</h2><p>Ưu đãi dành riêng và lịch sử tích lũy của bạn.</p></div>{membership && <span className="rewards-balance"><Coins size={18} />{membership.pointBalance.toLocaleString('vi-VN')} điểm</span>}</header>
    {membership && <div className="membership-card-large"><MembershipCard membership={membership} /><section className="account-panel membership-benefits"><div className="account-panel-heading"><div><span className="section-eyebrow">ĐẶC QUYỀN THÀNH VIÊN</span><h2>Quyền lợi theo hạng</h2></div></div><div className="membership-benefit-table"><div className="membership-benefit-head"><span>Hạng</span><span>Điểm tích lũy</span><span>Quyền lợi</span></div>{[...(membership.levels ?? [])].sort((a, b) => a.minPoints - b.minPoints).map((level) => <div className={`membership-benefit-row${level.name === membership.memberLevel ? ' current' : ''}`} key={level.name}><strong>{level.name}{level.name === membership.memberLevel && <small>Hạng hiện tại</small>}</strong><span>{level.minPoints.toLocaleString('vi-VN')} điểm</span><p>{level.benefits}</p></div>)}</div></section></div>}{!membership && !loadError && <div className="membership-skeleton" aria-label="Đang tải quyền lợi thành viên"><i /><i /></div>}
    <section className="account-panel"><div className="account-tabs" role="tablist" aria-label="Ưu đãi và điểm thành viên"><button role="tab" aria-selected={tab === 'vouchers'} className={tab === 'vouchers' ? 'selected' : ''} type="button" onClick={() => navigate('/profile/rewards?tab=vouchers')}><TicketPercent size={17} />Voucher</button><button role="tab" aria-selected={tab === 'points'} className={tab === 'points' ? 'selected' : ''} type="button" onClick={() => navigate('/profile/rewards?tab=points')}><Coins size={17} />Điểm thành viên</button></div>
      {loadError ? <div className="account-error" role="alert"><span>Không tải được dữ liệu</span><button type="button" onClick={() => void retryLoad()}><RotateCw size={14} /> Thử lại</button></div> : tab === 'vouchers' ? <><div className="voucher-tabs account-voucher-tabs" role="tablist" aria-label="Lọc voucher"><button role="tab" aria-selected={voucherTab === 'active'} className={voucherTab === 'active' ? 'selected' : ''} type="button" onClick={() => setVoucherTab('active')}>Đang áp dụng <span>{categorizedVouchers.active.length}</span></button><button role="tab" aria-selected={voucherTab === 'expiring'} className={voucherTab === 'expiring' ? 'selected' : ''} type="button" onClick={() => setVoucherTab('expiring')}>Sắp hết hạn <span>{categorizedVouchers.expiring.length}</span></button></div>{loading ? <div className="account-skeleton" aria-label="Đang tải voucher"><i /><i /></div> : currentVouchers.length ? <div className="account-voucher-list">{currentVouchers.map((voucher) => <VoucherCard key={voucher.voucherId} voucher={voucher} expiring={voucherTab === 'expiring'} />)}</div> : <div className="account-empty"><TicketPercent size={26} /><p>Hiện chưa có voucher nào dành cho bạn.</p><Link to="/products" className="account-text-link">Khám phá sản phẩm <ArrowRight size={15} /></Link></div>}</> : <><div className="account-panel-heading point-history-heading"><div><span className="section-eyebrow">GIAO DỊCH TÍCH LŨY</span><h2>Lịch sử điểm</h2></div></div>{loading ? <div className="account-skeleton" aria-label="Đang tải lịch sử điểm"><i /><i /><i /></div> : history.length ? <><div className="point-transaction-table"><div className="point-transaction-head"><span>Ngày</span><span>Nội dung</span><span>Số điểm</span><span>Điểm còn lại</span></div>{history.map((item) => <div className="point-transaction-row" key={item.id}><time>{new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</time><strong>{item.description}</strong><span className={item.points < 0 ? 'transaction-negative' : 'transaction-positive'}>{item.points > 0 ? '+' : ''}{item.points.toLocaleString('vi-VN')}</span><span>{item.balanceAfter.toLocaleString('vi-VN')}</span></div>)}</div><div className="point-transaction-mobile">{history.map((item) => <article key={item.id}><div><strong>{item.description}</strong><time>{new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</time></div><div><strong className={item.points < 0 ? 'transaction-negative' : 'transaction-positive'}>{item.points > 0 ? '+' : ''}{item.points.toLocaleString('vi-VN')} điểm</strong><small>Còn lại {item.balanceAfter.toLocaleString('vi-VN')} điểm</small></div></article>)}</div><nav className="account-pagination" aria-label="Phân trang lịch sử điểm"><span>{historyTotal ? `Trang ${historyPage} / ${Math.ceil(historyTotal / 10)}` : ''}</span><div><button type="button" disabled={historyPage <= 1} onClick={() => void loadTransactions(historyPage - 1)}><ArrowLeft size={15} /> Trước</button><button type="button" disabled={historyPage * 10 >= historyTotal} onClick={() => void loadTransactions(historyPage + 1)}>Sau <ArrowRight size={15} /></button></div></nav></> : <div className="account-empty"><Coins size={26} /><p>Chưa có giao dịch điểm nào</p></div>}<p className="points-note">Điểm được cộng sau khi đơn hàng giao thành công.</p></>}
    </section>
  </div>;
}