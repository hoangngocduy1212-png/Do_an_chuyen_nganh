import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequestError, authApi } from '../../api/auth';
import { AuthShell } from '../../components/auth/AuthShell';
import styles from '../../components/auth/auth.module.css';

const SUCCESS_MESSAGE = 'Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (kể cả mục Spam).';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (secondsRemaining === 0) return;
    const timerId = window.setTimeout(() => setSecondsRemaining((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timerId);
  }, [secondsRemaining]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (secondsRemaining > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      // Luôn dùng cùng thông báo để không tiết lộ email có trong hệ thống hay không.
      setSent(true);
      setSecondsRemaining(60);
    } catch (requestError) {
      setError(requestError instanceof AuthRequestError ? requestError.message : 'Không thể kết nối máy chủ, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className={styles['auth-form-content']}>
        <p className={styles['auth-eyebrow']}>KHÔI PHỤC TÀI KHOẢN</p>
        <h2>Quên mật khẩu?</h2>
        <p className={styles['auth-intro']}>Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu cho bạn.</p>
        <form className={`${styles['auth-form']} ${styles['recovery-form']}`} onSubmit={onSubmit}>
          <div className={styles['auth-field']}>
            <label htmlFor="forgot-email">Email <span>*</span></label>
            <input id="forgot-email" type="email" autoComplete="email" placeholder="ten@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          {sent && <p className={styles['auth-success']} role="status">{SUCCESS_MESSAGE}</p>}
          {error && <p className={styles['auth-alert']} role="alert">{error}</p>}
          <button className={styles['auth-submit']} type="submit" disabled={loading || secondsRemaining > 0}>
            {loading ? 'Đang gửi...' : secondsRemaining > 0 ? `Gửi lại sau ${secondsRemaining} giây` : sent ? 'Gửi lại liên kết đặt lại' : 'Gửi liên kết đặt lại'}
          </button>
        </form>
        <p className={styles['auth-bottom-link']}><Link to="/login">← Quay lại đăng nhập</Link></p>
      </div>
    </AuthShell>
  );
}