import { useState } from 'react';
import { ConfirmDialog } from '../account/ConfirmDialog';

export function ReturnOrderDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return <ConfirmDialog open={open} title="Yêu cầu đổi trả" description="Cho Muadee biết lý do để hỗ trợ bạn nhanh hơn." confirmLabel="Gửi yêu cầu" confirmDisabled={!reason.trim()} onCancel={onClose} onConfirm={() => onConfirm(reason)}><label className="order-action-label">Lý do đổi trả<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Mô tả tình trạng sản phẩm" /></label></ConfirmDialog>;
}