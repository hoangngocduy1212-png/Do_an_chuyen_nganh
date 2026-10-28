import { Minus, Plus } from 'lucide-react';

export function QuantitySelector({ quantity, stock, unit, onChange, disabled = false }: { quantity: number; stock: number; unit: string; onChange: (quantity: number) => void; disabled?: boolean }) {
  const step = unit === 'kg' ? 0.5 : 1;
  return <div className="quantity-stepper" aria-label={`Số lượng ${quantity} ${unit}`}>
    <button type="button" aria-label="Giảm số lượng" disabled={disabled || quantity <= step} onClick={() => onChange(Math.max(step, Number((quantity - step).toFixed(2))))}><Minus size={14} /></button>
    <span aria-live="polite">{Number.isInteger(quantity) ? quantity : quantity.toLocaleString('vi-VN')}</span>
    <button type="button" aria-label="Tăng số lượng" disabled={disabled || quantity + step > stock} onClick={() => onChange(Number((quantity + step).toFixed(2)))}><Plus size={14} /></button>
  </div>;
}