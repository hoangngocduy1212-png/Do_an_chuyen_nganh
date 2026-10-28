import { useState } from 'react';
import { ConfirmDialog } from '../account/ConfirmDialog';

export function CancelOrderDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return <ConfirmDialog open={open} title="Hủy đơn hàng?" description="Đơn hàng sẽ được hủy sau khi bạn xác nhận." confirmLabel="Xác nhận hủy" danger onCancel={onClose} onConfirm={() => onConfirm(reason)}><label className="order-action-label">Lý do hủy<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Chia sẻ lý do (không bắt buộc)" /></label></ConfirmDialog>;
}