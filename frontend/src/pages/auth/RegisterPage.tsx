import { useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthRequestError, authApi } from '../../api/auth';
import { AuthShell } from '../../components/auth/AuthShell';
import styles from '../../components/auth/auth.module.css';
import { useAuth } from '../../store/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0\d{9}$/;

export default function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fullNameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Họ và tên cần có ít nhất 2 ký tự';
    else if (form.fullName.trim().length > 100) next.fullName = 'Họ và tên không được vượt quá 100 ký tự';
    if (!form.email.trim()) next.email = 'Vui lòng nhập email';
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Email không hợp lệ';
    if (!PHONE_PATTERN.test(form.phone)) next.phone = 'Số điện thoại cần gồm 10 chữ số và bắt đầu bằng 0';
    if (form.password.length < 8) next.password = 'Mật khẩu cần có ít nhất 8 ký tự';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) next.password = 'Mật khẩu cần có cả chữ cái và chữ số';
    if (confirmation !== form.password) next.confirmation = 'Mật khẩu nhập lại không khớp';
    setFieldErrors(next);
    if (next.fullName) fullNameRef.current?.focus();
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await authApi.register({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
      signIn(result.accessToken, {
        userId: result.user.userId,
        fullName: result.user.fullName,
        email: result.user.email ?? form.email.trim(),
        role: result.user.role,
      }, result.refreshToken);
      const returnTo = new URLSearchParams(location.search).get('returnTo');
      navigate(returnTo?.startsWith('/') ? returnTo : '/');
    } catch (error) {
      if (error instanceof AuthRequestError && error.code === 'EMAIL_ALREADY_EXISTS') {
        setServerError('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
      } else if (error instanceof AuthRequestError && error.code === 'VALIDATION_ERROR') {
        setServerError(error.message);
      } else {
        setServerError('Không thể tạo tài khoản lúc này. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  }

  return (
    <AuthShell>
      <div className={styles['auth-form-content']}>
        <p className={styles['auth-eyebrow']}>THÀNH VIÊN MUADEE</p>
        <h2>Tạo tài khoản</h2>
        <p className={`${styles['auth-intro']} ${styles['register-intro']}`}>Đăng ký để theo dõi đơn hàng, tích điểm và nhận ưu đãi riêng.</p>
        <form className={`${styles['auth-form']} ${styles['register-form']}`} onSubmit={onSubmit} noValidate>
          <div className={styles['auth-field']}>
            <label htmlFor="register-name">Họ và tên <span>*</span></label>
            <input ref={fullNameRef} id="register-name" autoComplete="name" placeholder="Nguyễn Minh Anh" value={form.fullName} aria-invalid={Boolean(fieldErrors.fullName)} onChange={(event) => updateField('fullName', event.target.value)} autoFocus />
            {fieldErrors.fullName && <p className={styles['field-error']}>{fieldErrors.fullName}</p>}
          </div>
          <div className={styles['auth-field']}>
            <label htmlFor="register-email">Email <span>*</span></label>
            <input id="register-email" type="email" autoComplete="email" placeholder="ten@email.com" value={form.email} aria-invalid={Boolean(fieldErrors.email)} onChange={(event) => updateField('email', event.target.value)} />
            {fieldErrors.email && <p className={styles['field-error']}>{fieldErrors.email}</p>}
          </div>
          <div className={styles['auth-field']}>
            <label htmlFor="register-phone">Số điện thoại <span>*</span></label>
            <input id="register-phone" type="tel" autoComplete="tel" inputMode="numeric" placeholder="0912345678" value={form.phone} aria-invalid={Boolean(fieldErrors.phone)} onChange={(event) => updateField('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} />
            {fieldErrors.phone && <p className={styles['field-error']}>{fieldErrors.phone}</p>}
          </div>
          <div className={styles['auth-field']}>
            <label htmlFor="register-password">Mật khẩu <span>*</span></label>
            <div className={styles['password-input-wrap']}>
              <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự, gồm chữ và số" value={form.password} aria-invalid={Boolean(fieldErrors.password)} onChange={(event) => updateField('password', event.target.value)} />
              <button type="button" className={styles['password-toggle']} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {fieldErrors.password && <p className={styles['field-error']}>{fieldErrors.password}</p>}
          </div>
          <div className={styles['auth-field']}>
            <label htmlFor="register-confirm-password">Nhập lại mật khẩu <span>*</span></label>
            <div className={styles['password-input-wrap']}>
              <input id="register-confirm-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirmation} aria-invalid={Boolean(fieldErrors.confirmation)} onChange={(event) => { setConfirmation(event.target.value); setFieldErrors((current) => ({ ...current, confirmation: '' })); }} />
              <button type="button" className={styles['password-toggle']} aria-label={showConfirmation ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} onClick={() => setShowConfirmation((visible) => !visible)}>
                {showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {fieldErrors.confirmation && <p className={styles['field-error']}>{fieldErrors.confirmation}</p>}
          </div>
          {serverError && <p className={styles['auth-alert']} role="alert">{serverError}</p>}
          <button className={styles['auth-submit']} type="submit" disabled={loading}>
            {loading && <LoaderCircle size={19} className={styles['button-spinner']} aria-hidden="true" />}
            {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>
        </form>
        <p className={styles['auth-bottom-link']}>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </div>
    </AuthShell>
  );
}
