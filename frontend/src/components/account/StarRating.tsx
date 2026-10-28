import { useState } from 'react';
import { Star } from 'lucide-react';

export function StarRating({ value, onChange, readOnly = false }: { value: number; onChange?: (rating: number) => void; readOnly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  const shownValue = hovered || value;
  return <div className={`account-star-rating${readOnly ? ' read-only' : ''}`} role={readOnly ? 'img' : 'radiogroup'} aria-label={`Đánh giá ${value} trên 5 sao`}>
    {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={readOnly} aria-label={`${rating} sao`} aria-checked={value === rating} role={readOnly ? undefined : 'radio'} tabIndex={readOnly ? -1 : value === rating || (!value && rating === 1) ? 0 : -1} onMouseEnter={() => !readOnly && setHovered(rating)} onMouseLeave={() => setHovered(0)} onFocus={() => !readOnly && setHovered(rating)} onBlur={() => setHovered(0)} onKeyDown={(event) => { if (!readOnly && (event.key === 'ArrowRight' || event.key === 'ArrowUp')) { event.preventDefault(); onChange?.(Math.min(5, rating + 1)); document.getElementById(`rating-${Math.min(5, rating + 1)}`)?.focus(); } if (!readOnly && (event.key === 'ArrowLeft' || event.key === 'ArrowDown')) { event.preventDefault(); onChange?.(Math.max(1, rating - 1)); document.getElementById(`rating-${Math.max(1, rating - 1)}`)?.focus(); } }} id={`rating-${rating}`} onClick={() => onChange?.(rating)}><Star size={21} fill={rating <= shownValue ? 'currentColor' : 'none'} /></button>)}
  </div>;
}