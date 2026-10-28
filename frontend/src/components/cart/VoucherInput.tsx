import { useState } from 'react';
import { Check, Tag, X } from 'lucide-react';
import { vouchersApi } from '../../api/vouchers';
import { formatMoney } from '../../utils/money';

export function VoucherInput({ amount, onApplied, onRemove, voucher }: { amount: number; onApplied: (code: string, discount: number) => void; onRemove: () => void; voucher?: { code: string; discount: number } }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function apply() {
    if (!code.trim() || loading) return;
    setLoading(true); setError('');
    try { const result = await vouchersApi.validate(code, amount); onApplied(code.trim().toUpperCase(), result.discountAmount); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể áp dụng mã giảm giá'); }
    finally { setLoading(false); }
  }
  return <div className="voucher-input">
    {voucher ? <div className="applied-voucher"><span><Tag size={15} />{voucher.code}<b>Giảm {formatMoney(voucher.discount)}</b></span><button type="button" aria-label="Gỡ mã giảm giá" onClick={onRemove}><X size={15} /></button></div> : <div className="voucher-entry"><label htmlFor="cart-voucher">Mã giảm giá</label><div><input id="cart-voucher" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void apply(); } }} placeholder="Nhập mã giảm giá" /><button type="button" disabled={loading || !code.trim()} onClick={() => void apply()}>{loading ? 'Đang kiểm tra' : 'Áp dụng'}</button></div>{error && <p role="alert">{error}</p>}</div>}
    {voucher && <span className="voucher-success"><Check size={14} />Đã áp dụng ưu đãi cho đơn hàng</span>}
  </div>;
}