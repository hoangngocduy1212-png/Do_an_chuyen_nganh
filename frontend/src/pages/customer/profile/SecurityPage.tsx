import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersApi, UserActionError } from '../../../api/users';
import { ConfirmDialog } from '../../../components/account/ConfirmDialog';
import { useAuth } from '../../../store/AuthContext';

function passwordStrength(password: string) {
  return [password.length >= 8, /[A-Za-z]/.test(password), /\d/.test(password), password.length >= 12].filter(Boolean).length;
}

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const strength = passwordStrength(newPassword);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Mật khẩu mới cần tối thiểu 8 ký tự, có cả chữ và số.');
      return;
    }
    if (newPassword !== confirmPassword) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setSaving(true);
    try {
      await usersApi.updatePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đổi mật khẩu thành công' }));
    } catch (requestError) {
      setError(requestError instanceof UserActionError && requestError.code === 'INVALID_CURRENT_PASSWORD' ? 'Mật khẩu hiện tại không đúng' : 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally { setSaving(false); }
  }

  async function deleteAccount() {
    setDeleting(true); setDeleteError('');
    try {
      await usersApi.deleteMe(deletePassword);
      setConfirmDelete(false);
      signOut();
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Tài khoản đã được xóa' }));
      navigate('/', { replace: true });
    } catch (requestError) {
      setDeleteError(requestError instanceof UserActionError && requestError.code === 'INVALID_CURRENT_PASSWORD' ? 'Mật khẩu hiện tại không đúng' : 'Không thể xóa tài khoản. Vui lòng thử lại.');
    } finally { setDeleting(false); }
  }

  function openDeleteDialog() { setDeletePassword(''); setDeleteText(''); setDeleteError(''); setConfirmDelete(true); }

  return <div className="account-page-stack"><section className="account-panel"><header className="account-panel-heading"><div><span className="section-eyebrow">BẢO VỆ TÀI KHOẢN</span><h2>Bảo mật tài khoản</h2></div><ShieldCheck size={23} className="security-heading-icon" /></header>
    <div className="security-section"><div className="security-section-title"><span><KeyRound size={18} /></span><div><strong>Đổi mật khẩu</strong><small>Chọn mật khẩu mạnh để bảo vệ tài khoản của bạn.</small></div></div><form className="account-form security-form" onSubmit={changePassword}>
      <label className="account-field" htmlFor="security-current-password">Mật khẩu hiện tại *<span className="password-field-wrap"><input id="security-current-password" type={showPasswords ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><button type="button" className="password-visibility" aria-label={showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPasswords((visible) => !visible)}>{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      <label className="account-field" htmlFor="security-new-password">Mật khẩu mới *<span className="password-field-wrap"><input id="security-new-password" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></span><span className="password-strength" aria-label={`Độ mạnh mật khẩu: ${strength} trên 4`}><span className={`password-strength-bar strength-${strength}`} /><span className={`password-strength-bar strength-${strength >= 2 ? strength : 0}`} /><span className={`password-strength-bar strength-${strength >= 3 ? strength : 0}`} /><span className={`password-strength-bar strength-${strength >= 4 ? strength : 0}`} /></span><small>{newPassword ? strength < 2 ? 'Yếu' : strength < 4 ? 'Trung bình' : 'Mạnh' : 'Tối thiểu 8 ký tự, có chữ và số'}</small></label>
      <label className="account-field" htmlFor="security-confirm-password">Nhập lại mật khẩu mới *<span className="password-field-wrap"><input id="security-confirm-password" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></span></label>
      {error && <p className="account-field-error" role="alert">{error}</p>}
      <button className="primary-button account-small-button" type="submit" disabled={saving}>{saving ? <><span className="account-spinner" aria-hidden="true" /> Đang cập nhật...</> : 'Cập nhật mật khẩu'}</button>
    </form></div>
    <div className="security-delete-section"><div><strong>Xóa tài khoản</strong><p>Tài khoản sẽ bị vô hiệu hóa và bạn không thể đăng nhập nữa. Lịch sử đơn hàng được giữ lại theo quy định.</p></div><button className="account-danger-outline" type="button" onClick={openDeleteDialog}><Trash2 size={16} /> Xóa tài khoản</button></div>
    </section><ConfirmDialog open={confirmDelete} title="Xác nhận xóa tài khoản?" description="Nhập mật khẩu và gõ XOA để xác nhận. Thao tác này sẽ vô hiệu hóa tài khoản của bạn." confirmLabel="Xóa tài khoản" danger busy={deleting} confirmDisabled={!deletePassword || deleteText !== 'XOA'} onConfirm={deleteAccount} onCancel={() => setConfirmDelete(false)}>
      <div className="delete-confirm-fields"><label className="account-field" htmlFor="delete-account-password">Mật khẩu hiện tại *<input id="delete-account-password" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label><label className="account-field" htmlFor="delete-account-confirmation">Nhập XOA để xác nhận *<input id="delete-account-confirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoCapitalize="characters" /></label>{deleteError && <p className="account-field-error" role="alert">{deleteError}</p>}</div>
    </ConfirmDialog></div>;
}
