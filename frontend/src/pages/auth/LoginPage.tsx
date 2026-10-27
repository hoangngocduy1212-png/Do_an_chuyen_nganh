import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth.api';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await authApi.login(email, password);
      signIn(res.accessToken, res.user);
      navigate(res.user.role === 'ADMIN' ? '/admin' : res.user.role === 'STAFF' ? '/staff' : '/');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Đăng nhập</h2>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button type="submit">Đăng nhập</button>
      <p>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
    </form>
  );
}
