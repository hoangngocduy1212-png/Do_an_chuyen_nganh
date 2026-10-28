import { useRef, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';

export function AvatarUploader({ value, onChange, name }: { value?: string; onChange: (image?: string) => void; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  function chooseFile(file?: File) {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Vui lòng chọn ảnh JPG, PNG hoặc WebP'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Ảnh đại diện không được vượt quá 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  }
  return <div className="avatar-uploader">
    <button className="avatar-uploader-image" type="button" onClick={() => inputRef.current?.click()} aria-label="Chọn ảnh đại diện">{value ? <img src={value} alt={`Ảnh đại diện của ${name}`} /> : name ? <span>{name.charAt(0).toLocaleUpperCase('vi')}</span> : <UserRound size={30} />}<i><Camera size={15} /></i></button>
    <div><button className="secondary-button account-small-button" type="button" onClick={() => inputRef.current?.click()}>Đổi ảnh</button><small>JPG, PNG hoặc WebP · tối đa 2 MB</small>{error && <span className="account-field-error" role="alert">{error}</span>}</div>
    <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
  </div>;
}