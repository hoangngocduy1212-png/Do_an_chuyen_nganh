import { useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthRequestError, authApi } from '../../api/auth';
import { useAuth } from '../../store/AuthContext';
import styles from './auth.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 8) next.password = 'Mật khẩu tối thiểu 8 ký tự';
    setErrors(next);
    if (next.email) emailRef.current?.focus();
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await authApi.login({ email: email.trim(), password });
      signIn(result.accessToken, {
        userId: result.user.userId,
        fullName: result.user.fullName,
        email: result.user.email ?? email.trim(),
        role: result.user.role,
      }, result.refreshToken);
      const returnTo = new URLSearchParams(location.search).get('returnTo');
      const destination = result.user.role === 'ADMIN'
        ? '/admin/dashboard'
        : result.user.role === 'STAFF' ? '/staff/orders' : returnTo?.startsWith('/') ? returnTo : '/';
      navigate(destination);
    } catch (error) {
      if (error instanceof AuthRequestError) {
        if (error.code === 'INVALID_CREDENTIALS') setServerError('Email hoặc mật khẩu không đúng');
        else if (error.code === 'ACCOUNT_LOCKED') setServerError('Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng');
        else setServerError(error.status === 500 || error.code === 'NETWORK_ERROR'
          ? 'Không thể kết nối máy chủ, vui lòng thử lại'
          : error.message);
      } else {
        setServerError('Không thể kết nối máy chủ, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles['auth-form-content']}>
      <p className={styles['auth-eyebrow']}>CHÀO MỪNG TRỞ LẠI</p>
      <h2>Đăng nhập</h2>
      <p className={styles['auth-intro']}>Theo dõi đơn hàng và tiếp tục hành trình mua sắm.</p>
      <form className={styles['auth-form']} onSubmit={onSubmit} noValidate>
        <div className={styles['auth-field']}>
          <label htmlFor="login-email">Email <span>*</span></label>
          <input
            ref={emailRef}
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="ten@email.com"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })); }}
            autoFocus
          />
          {errors.email && <p className={styles['field-error']} id="login-email-error">{errors.email}</p>}
        </div>
        <div className={styles['auth-field']}>
          <label htmlFor="login-password">Mật khẩu <span>*</span></label>
          <div className={styles['password-input-wrap']}>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); }}
            />
            <button type="button" className={styles['password-toggle']} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {errors.password && <p className={styles['field-error']} id="login-password-error">{errors.password}</p>}
        </div>
        <div className={styles['forgot-link-row']}><Link to="/forgot-password">Quên mật khẩu?</Link></div>
        {serverError && <p className={styles['auth-alert']} role="alert">{serverError}</p>}
        <button className={styles['auth-submit']} type="submit" disabled={loading}>
          {loading && <LoaderCircle size={19} className={styles['button-spinner']} aria-hidden="true" />}
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      <p className={styles['auth-bottom-link']}>Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link></p>
    </div>
  );
}