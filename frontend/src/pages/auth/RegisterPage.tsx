import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth.api';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';

export default function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await authApi.register({ ...form, phone: form.phone || undefined });
      signIn(res.accessToken, res.user);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Đăng ký</h2>
      <input placeholder="Họ và tên" value={form.fullName} onChange={set('fullName')} required />
      <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      <input placeholder="Số điện thoại" value={form.phone} onChange={set('phone')} />
      <input type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" value={form.password} onChange={set('password')} minLength={6} required />
      {error && <p className="error">{error}</p>}
      <button type="submit">Tạo tài khoản</button>
      <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </form>
  );
}
