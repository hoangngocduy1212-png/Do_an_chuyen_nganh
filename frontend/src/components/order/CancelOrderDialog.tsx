import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../account/ConfirmDialog';

const reasons = ['Tôi muốn thay đổi thông tin nhận hàng', 'Tôi muốn thay đổi sản phẩm', 'Tôi không còn nhu cầu', 'Tìm thấy sản phẩm ở nơi khác', 'Lý do khác'];

export function CancelOrderDialog({ open, onClose, onConfirm, busy = false, paid = false }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; busy?: boolean; paid?: boolean }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return <ConfirmDialog open={open} title="Hủy đơn hàng?" description={paid ? 'Số tiền đã thanh toán sẽ được hoàn lại.' : 'Đơn hàng sẽ được hủy sau khi bạn xác nhận.'} confirmLabel="Xác nhận hủy" danger busy={busy} confirmDisabled={!reason} onCancel={onClose} onConfirm={() => onConfirm(reason)}><label className="order-action-label" htmlFor="cancel-order-reason">Lý do hủy<select id="cancel-order-reason" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Chọn lý do hủy</option>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label></ConfirmDialog>;
}