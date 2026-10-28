import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Clock3, CreditCard, RefreshCw } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { paymentsApi } from '../../api/payments';
import { QrPaymentPanel } from '../../components/order/QrPaymentPanel';
import { PaymentMethodSelector } from '../../components/order/PaymentMethodSelector';
import { checkoutStore, useCheckout } from '../../store/checkoutStore';
import type { CustomerOrder, PaymentMethod } from '../../types/order';
import type { PaymentRequestResult } from '../../types/payment';
import { formatMoney } from '../../utils/money';

const PAYMENT_WINDOW_MS = 15 * 60_000;

export default function PaymentPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const checkout = useCheckout();
  const [order, setOrder] = useState<CustomerOrder>();
  const [payment, setPayment] = useState<PaymentRequestResult>();
  const [error, setError] = useState(false);
  const [remaining, setRemaining] = useState(PAYMENT_WINDOW_MS);
  const [retrying, setRetrying] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const method = checkoutStore.getOrderPaymentMethod(orderId) ?? 'TRANSFER';
  const [retryMethod, setRetryMethod] = useState<PaymentMethod>(method as PaymentMethod);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const orderData = await ordersApi.get(orderId);
        let paymentData = checkoutStore.getPayment<PaymentRequestResult>(orderId);
        if (!paymentData) paymentData = await paymentsApi.forOrder(orderId).catch(() => null);
        if (!paymentData) paymentData = await paymentsApi.create(orderId, (orderData.paymentMethod ?? method) as PaymentMethod);
        if (!active) return;
        if (!paymentData.expiresAt && paymentData.paymentMethod === 'TRANSFER') paymentData = { ...paymentData, expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() };
        checkoutStore.setPayment(orderId, paymentData);
        setOrder(orderData);
        setPayment(paymentData);
        if (paymentData.paymentStatus === 'SUCCESS') { navigate(`/orders/${orderId}/success`, { replace: true }); return; }
        if (paymentData.paymentUrl) setRedirecting(true);
      } catch { if (active) setError(true); }
    }
    void initialize();
    return () => { active = false; };
  }, [orderId, reloadKey]);

  useEffect(() => {
    if (!payment?.paymentUrl || !redirecting) return;
    const timer = window.setTimeout(() => window.location.assign(payment.paymentUrl as string), 500);
    return () => window.clearTimeout(timer);
  }, [payment?.paymentUrl, redirecting]);

  useEffect(() => {
    if (!payment || payment.paymentMethod !== 'TRANSFER' || payment.paymentStatus !== 'PENDING') return;
    const deadline = payment.expiresAt ? Date.parse(payment.expiresAt) : Date.now() + PAYMENT_WINDOW_MS;
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const countdown = window.setInterval(tick, 1000);
    const poll = window.setInterval(async () => {
      try {
        const result = await paymentsApi.get(payment.paymentId);
        const updated = { ...payment, ...result, expiresAt: result.expiresAt ?? payment.expiresAt };
        setPayment(updated); checkoutStore.setPayment(orderId, updated);
        if (result.paymentStatus === 'SUCCESS') { window.clearInterval(countdown); window.clearInterval(poll); navigate(`/orders/${orderId}/success`, { replace: true }); }
        if (result.paymentStatus === 'FAILED' || result.paymentStatus === 'REFUNDED') { window.clearInterval(countdown); window.clearInterval(poll); }
      } catch { /* Transient polling failures should not interrupt the payment screen. */ }
    }, 3000);
    return () => { window.clearInterval(countdown); window.clearInterval(poll); };
  }, [payment?.paymentId, payment?.paymentStatus, payment?.paymentMethod, orderId, navigate]);

  async function retryPayment() {
    if (retrying) return;
    setRetrying(true);
    try {
      const next = await paymentsApi.retry(orderId, retryMethod, order?.totalAmount);
      checkoutStore.setOrderPaymentMethod(orderId, retryMethod);
      checkoutStore.setPayment(orderId, next); setPayment(next); setRemaining(PAYMENT_WINDOW_MS);
      if (next.paymentUrl) setRedirecting(true);
    } catch { setError(true); }
    finally { setRetrying(false); }
  }

  const transferExpired = remaining <= 0 || (payment?.expiresAt ? Date.parse(payment.expiresAt) <= Date.now() : false);
  const paymentFailed = payment?.paymentStatus === 'FAILED' || payment?.paymentStatus === 'REFUNDED' || transferExpired;
  const countdown = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor(remaining % 60000 / 1000)).padStart(2, '0')}`;
  if (error) return <div className="customer-shell payment-page"><div className="listing-message"><strong>Không tải được thông tin thanh toán</strong><p>Đơn hàng vẫn được lưu trong danh sách đơn hàng.</p><Link to="/orders">Xem đơn hàng</Link></div></div>;
  if (!order || !payment || redirecting) return <div className="customer-shell payment-page"><span className="section-eyebrow">THANH TOÁN ĐƠN HÀNG</span><h1>{redirecting ? 'Đang chuyển tới cổng thanh toán...' : 'Đang tải thông tin thanh toán'}</h1><p className="payment-order-meta">Vui lòng không đóng trang này.</p><div className="payment-loading" aria-label="Đang tải thanh toán"><i /></div></div>;

  return <div className="customer-shell payment-page">
    <span className="section-eyebrow">THANH TOÁN ĐƠN HÀNG</span><h1>{paymentFailed ? 'Thanh toán chưa hoàn tất' : 'Hoàn tất thanh toán'}</h1><p className="payment-order-meta">Mã đơn {order.orderCode} · {formatMoney(order.totalAmount)}</p>
    {paymentFailed ? <section className="payment-failed-panel"><strong>Giao dịch chưa được xác nhận hoặc mã thanh toán đã hết hạn.</strong><p>Đơn hàng vẫn đang chờ thanh toán. Bạn có thể tạo lại giao dịch hoặc thanh toán sau.</p><PaymentMethodSelector value={retryMethod} onChange={setRetryMethod} /><div><button type="button" disabled={retrying} onClick={() => void retryPayment()}><RefreshCw size={15} />{retrying ? 'Đang tạo mã...' : 'Tạo lại giao dịch'}</button><Link to={`/orders/${orderId}`}>Thanh toán sau</Link></div></section> : payment.paymentMethod === 'TRANSFER' ? <>
      <div className="payment-countdown"><Clock3 size={15} />Mã thanh toán còn hiệu lực <strong>{countdown}</strong></div>
      <QrPaymentPanel src={payment.qrCodeUrl} orderId={order.orderCode} amount={payment.amount ?? order.totalAmount} bankName={payment.bankName} accountNumber={payment.accountNumber} accountName={payment.accountName} transferContent={payment.transferContent} />
      <div className="payment-pending-status" role="status">Đang chờ xác nhận thanh toán…</div>
    </> : <section className="card-payment-panel"><CreditCard size={26} /><h2>Đang chuyển tới cổng thanh toán</h2><p>Thông tin thẻ chỉ được nhập trên cổng thanh toán bảo mật, không lưu trong ứng dụng Muadee.</p><button type="button" onClick={() => { if (payment.paymentUrl) window.location.assign(payment.paymentUrl); }}>Tiếp tục thanh toán <ArrowRight size={16} /></button></section>}
    <div className="payment-secondary-actions"><Link to={`/orders/${orderId}`}>Thanh toán sau</Link><Link to="/orders">Đơn hàng của tôi</Link></div>
  </div>;
}
