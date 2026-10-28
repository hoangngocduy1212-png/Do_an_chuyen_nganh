import { useState, type FormEvent } from 'react';
import { StarRating } from './StarRating';

export function ReviewForm({ onSubmit, onCancel }: { onSubmit: (rating: number, comment: string) => Promise<void>; onCancel: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!rating) { setError('Vui lòng chọn từ 1 đến 5 sao.'); return; } if (!comment.trim()) { setError('Vui lòng chia sẻ cảm nhận của bạn.'); return; } setSaving(true); setError(''); try { await onSubmit(rating, comment.trim()); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Chưa gửi được đánh giá. Vui lòng thử lại.'); } finally { setSaving(false); } }
  return <form className="review-form" onSubmit={submit}><label className="account-field">Mức độ hài lòng *<StarRating value={rating} onChange={(next) => { setRating(next); setError(''); }} /></label><label className="account-field">Nhận xét *<textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..." /><small className="review-character-count">{comment.length}/500 ký tự</small></label>{error && <p className="account-field-error" role="alert">{error}</p>}<div className="account-form-actions"><button className="secondary-button" type="button" onClick={onCancel}>Hủy</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Đang gửi...' : 'Gửi đánh giá'}</button></div></form>;
}