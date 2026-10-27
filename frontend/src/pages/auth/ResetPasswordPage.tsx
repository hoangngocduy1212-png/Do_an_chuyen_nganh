import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthRequestError, authApi } from '../../api/auth';
import { AuthShell } from '../../components/auth/AuthShell';
import styles from '../../components/auth/auth.module.css';

const INVALID_TOKEN_MESSAGE = 'Liên kết đã hết hạn hoặc không hợp lệ';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(!token);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timerId = window.setTimeout(() => navigate('/login'), 3000);
    return () => window.clearTimeout(timerId);
  }, [navigate, success]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) { setError('Mật khẩu tối thiểu 8 ký tự'); return; }
    if (password !== confirmation) { setError('Mật khẩu nhập lại không khớp'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (requestError) {
      if (requestError instanceof AuthRequestError && requestError.code === 'INVALID_OR_EXPIRED_TOKEN') {
        setInvalidToken(true);
      } else {
        setError(requestError instanceof AuthRequestError ? requestError.message : 'Không thể kết nối máy chủ, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className={styles['auth-form-content']}>
        <p className={styles['auth-eyebrow']}>BẢO MẬT TÀI KHOẢN</p>
        <h2>Đặt lại mật khẩu</h2>
        <p className={styles['auth-intro']}>Chọn mật khẩu mới để tiếp tục mua sắm cùng Muadee.</p>
        {invalidToken ? (
          <div className={styles['auth-alert']} role="alert">
            <p>{INVALID_TOKEN_MESSAGE}</p>
            <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
          </div>
        ) : success ? (
          <div className={styles['auth-success']} role="status">
            <p>Đặt lại mật khẩu thành công</p>
            <p>Bạn sẽ được chuyển về trang đăng nhập sau 3 giây.</p>
            <Link to="/login">Đăng nhập ngay</Link>
          </div>
        ) : (
          <form className={`${styles['auth-form']} ${styles['recovery-form']}`} onSubmit={onSubmit}>
            <div className={styles['auth-field']}>
              <label htmlFor="new-password">Mật khẩu mới <span>*</span></label>
              <div className={styles['password-input-wrap']}>
                <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" className={styles['password-toggle']} aria-label={showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            <div className={styles['auth-field']}>
              <label htmlFor="confirm-password">Nhập lại mật khẩu mới <span>*</span></label>
              <div className={styles['password-input-wrap']}>
                <input id="confirm-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
                <button type="button" className={styles['password-toggle']} aria-label={showConfirmation ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} onClick={() => setShowConfirmation((visible) => !visible)}>
                  {showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            {error && <p className={styles['auth-alert']} role="alert">{error}</p>}
            <button className={styles['auth-submit']} type="submit" disabled={loading}>{loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}</button>
          </form>
        )}
        <p className={styles['auth-bottom-link']}><Link to="/login">Quay lại đăng nhập</Link></p>
      </div>
    </AuthShell>
  );
}