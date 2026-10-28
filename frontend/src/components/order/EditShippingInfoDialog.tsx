import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../account/ConfirmDialog';

interface ShippingInfo {
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: string;
  pickupTime?: string;
  pickupNote?: string;
}

const pickupTimes = ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00'];

export function EditShippingInfoDialog({ open, onClose, onConfirm, initialValue, receiveMethod = 'DELIVERY', busy = false }: { open: boolean; onClose: () => void; onConfirm: (value: ShippingInfo) => void; initialValue: ShippingInfo; receiveMethod?: 'DELIVERY' | 'PICKUP'; busy?: boolean }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue.recipientName, initialValue.recipientPhone, initialValue.shippingAddress]);
  const update = (field: keyof ShippingInfo, next: string) => setValue((current) => ({ ...current, [field]: next }));
  const valid = receiveMethod === 'PICKUP'
    ? Boolean(value.pickupTime)
    : Boolean(value.recipientName?.trim() && /^0\d{9}$/.test((value.recipientPhone ?? '').replace(/\s/g, '')) && (value.shippingAddress?.trim().length ?? 0) >= 12);
  return <ConfirmDialog open={open} title="Sửa thông tin nhận hàng" description="Cập nhật người nhận và địa chỉ trước khi cửa hàng chuẩn bị đơn." confirmLabel="Lưu thay đổi" busy={busy} confirmDisabled={!valid} onCancel={onClose} onConfirm={() => onConfirm(value)}>
    {receiveMethod === 'PICKUP' ? <>
      <label className="order-action-label" htmlFor="shipping-pickup-time">Khung giờ nhận<select id="shipping-pickup-time" required value={value.pickupTime ?? ''} onChange={(event) => update('pickupTime', event.target.value)}><option value="">Chọn khung giờ</option>{pickupTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
      <label className="order-action-label" htmlFor="shipping-pickup-note">Ghi chú nhận hàng<textarea id="shipping-pickup-note" value={value.pickupNote ?? ''} onChange={(event) => update('pickupNote', event.target.value)} /></label>
    </> : <>
      <label className="order-action-label" htmlFor="shipping-recipient-name">Tên người nhận<input id="shipping-recipient-name" required value={value.recipientName ?? ''} onChange={(event) => update('recipientName', event.target.value)} /></label>
      <label className="order-action-label" htmlFor="shipping-recipient-phone">Số điện thoại<input id="shipping-recipient-phone" required inputMode="tel" value={value.recipientPhone ?? ''} onChange={(event) => update('recipientPhone', event.target.value)} /></label>
      <label className="order-action-label" htmlFor="shipping-address">Địa chỉ nhận hàng<textarea id="shipping-address" required value={value.shippingAddress ?? ''} onChange={(event) => update('shippingAddress', event.target.value)} /></label>
    </>}
  </ConfirmDialog>;
}
