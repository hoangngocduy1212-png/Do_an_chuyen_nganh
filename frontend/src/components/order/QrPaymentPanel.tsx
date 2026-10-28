import { useState } from 'react';
import { CheckCircle2, Copy, QrCode } from 'lucide-react';
import { formatMoney } from '../../utils/money';

export function QrPaymentPanel({ src, orderId, amount, bankName, accountNumber, accountName, transferContent }: { src?: string; orderId: string; amount: number; bankName?: string; accountNumber?: string; accountName?: string; transferContent?: string }) {
  const [copied, setCopied] = useState('');
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: `Đã sao chép ${label.toLocaleLowerCase('vi')}` }));
      window.setTimeout(() => setCopied(''), 1800);
    } catch { window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Không thể sao chép. Vui lòng nhập thông tin thủ công.' })); }
  }
  const copyButton = (label: string, value: string) => <button className="copy-payment-value" type="button" aria-label={`Sao chép ${label}`} onClick={() => void copy(label, value)}>{copied === label ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>;
  return <section className="qr-payment-panel"><div className="qr-payment-heading"><QrCode size={21} /><div><strong>Quét mã để thanh toán</strong><span>Đơn hàng {orderId}</span></div></div><div className="qr-payment-content"><div className="qr-image-frame">{src ? <img src={src} alt="Mã QR thanh toán đơn hàng" /> : <div className="qr-unavailable">Không có mã QR. Vui lòng dùng thông tin chuyển khoản.</div>}</div><div className="bank-transfer-details">
    <div><span>Ngân hàng</span><strong>{bankName || 'Ngân hàng đang cập nhật'}</strong>{bankName && copyButton('Ngân hàng', bankName)}</div>
    <div><span>Số tài khoản</span><strong>{accountNumber || 'Đang cập nhật'}</strong>{accountNumber && copyButton('Số tài khoản', accountNumber)}</div>
    <div><span>Chủ tài khoản</span><strong>{accountName || 'Đang cập nhật'}</strong>{accountName && copyButton('Chủ tài khoản', accountName)}</div>
    <div><span>Số tiền</span><strong>{formatMoney(amount)}</strong>{copyButton('Số tiền', String(amount))}</div>
    <div><span>Nội dung chuyển khoản</span><strong>{transferContent || orderId}</strong>{copyButton('Nội dung chuyển khoản', transferContent || orderId)}</div>
  </div></div><p>Mở ứng dụng ngân hàng và quét mã QR hoặc chuyển khoản đúng thông tin ở trên.</p><span className="qr-payment-note"><CheckCircle2 size={14} />Không nhập thông tin thẻ trong ứng dụng Muadee.</span></section>;
}
