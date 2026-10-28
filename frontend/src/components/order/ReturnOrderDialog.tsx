import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../account/ConfirmDialog';

const reasons = ['Sản phẩm bị lỗi hoặc hư hỏng', 'Sản phẩm không đúng mô tả', 'Giao sai sản phẩm', 'Lý do khác'];

export function ReturnOrderDialog({ open, onClose, onConfirm, busy = false }: { open: boolean; onClose: () => void; onConfirm: (reason: string, description: string) => void; busy?: boolean }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => { if (open) { setReason(''); setDescription(''); } }, [open]);
  return <ConfirmDialog open={open} title="Yêu cầu trả hàng" description="Cho Muadee biết lý do để hỗ trợ bạn nhanh hơn." confirmLabel="Gửi yêu cầu" busy={busy} confirmDisabled={!reason || !description.trim()} onCancel={onClose} onConfirm={() => onConfirm(reason, description)}><label className="order-action-label" htmlFor="return-order-reason">Lý do trả hàng<select id="return-order-reason" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Chọn lý do</option>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label><label className="order-action-label" htmlFor="return-order-description">Mô tả<textarea id="return-order-description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả tình trạng sản phẩm" /></label></ConfirmDialog>;
}