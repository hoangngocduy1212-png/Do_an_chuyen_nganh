import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleX, LoaderCircle } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { paymentsApi } from '../../api/payments';
import { checkoutStore } from '../../store/checkoutStore';
import type { PaymentRequestResult } from '../../types/payment';

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const paymentId = params.get('paymentId');
  const [payment, setPayment] = useState<PaymentRequestResult>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const result = paymentId ? await paymentsApi.get(paymentId) : await paymentsApi.forOrder(orderId);
        if (active) {
          if (!result) {
            setFailed(true);
            return;
          }
          setPayment(result);
          if (result.paymentStatus === 'SUCCESS') checkoutStore.setPayment(orderId, result);
          setFailed(result.paymentStatus === 'FAILED' || result.paymentStatus === 'REFUNDED');
        }
      } catch { if (active) setFailed(true); }
      finally { if (active) setLoading(false); }
    }
    if (orderId) void verify(); else { setFailed(true); setLoading(false); }
    return () => { active = false; };
  }, [orderId, paymentId]);

  if (loading) return <div className="customer-shell payment-result"><LoaderCircle className="payment-result-spinner" size={30} /><h1>Đang xác minh thanh toán</h1><p>Muadee đang kiểm tra trạng thái giao dịch với cổng thanh toán.</p></div>;
  const success = payment?.paymentStatus === 'SUCCESS';
  const pending = payment?.paymentStatus === 'PENDING';
  return <div className="customer-shell payment-result"><span className={success ? 'success' : 'failed'}>{success ? <CheckCircle2 size={30} /> : <CircleX size={30} />}</span><h1>{success ? 'Thanh toán thành công' : pending ? 'Đang chờ xác nhận thanh toán' : 'Thanh toán chưa hoàn tất'}</h1><p>{success ? 'Muadee đã nhận được xác nhận giao dịch.' : pending ? 'Giao dịch chưa được xác nhận. Bạn có thể thanh toán sau hoặc kiểm tra lại trong đơn hàng.' : 'Giao dịch không thành công. Bạn có thể thử lại hoặc chọn phương thức khác.'}</p>{success && <Link to={`/orders/${orderId}/success`}>Xem đơn hàng</Link>}{!success && orderId && <Link to={`/payment/${orderId}`}>Thử lại</Link>}{!success && orderId && <Link className="secondary-button" to={`/orders/${orderId}`}>Chọn phương thức khác</Link>}<Link className="secondary-button" to="/orders">Đến đơn hàng của tôi</Link></div>;
}
