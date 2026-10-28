import { Banknote, CreditCard, QrCode } from 'lucide-react';
import type { PaymentMethod } from '../../types/order';

const options: Array<{ value: PaymentMethod; label: string; note: string; Icon: typeof Banknote }> = [
  { value: 'CASH', label: 'Thanh toán khi nhận hàng', note: 'Thanh toán bằng tiền mặt khi nhận đơn', Icon: Banknote },
  { value: 'TRANSFER', label: 'Chuyển khoản QR', note: 'Quét mã QR để thanh toán nhanh', Icon: QrCode },
  { value: 'CARD', label: 'Thẻ ATM/Visa/Mastercard', note: 'Thanh toán an toàn trên cổng thanh toán', Icon: CreditCard },
];

export function PaymentMethodSelector({ value, onChange, pickup = false }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void; pickup?: boolean }) {
  return <fieldset className="payment-methods"><legend>Phương thức thanh toán</legend>{options.map(({ value: method, label, note, Icon }) => <label className={value === method ? 'selected' : ''} key={method}><input type="radio" name="payment-method" value={method} checked={value === method} onChange={() => onChange(method)} /><Icon size={20} /><span><strong>{method === 'CASH' && pickup ? 'Thanh toán tại cửa hàng khi nhận hàng' : label}</strong><small>{method === 'CASH' && pickup ? 'Thanh toán tại quầy khi đến lấy đơn' : note}</small></span></label>)}</fieldset>;
}