import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { staffApi, type StaffProfile } from '../../api/staff';
import { useAuth } from '../../store/AuthContext';
import { AvatarUploader } from '../../components/account/AvatarUploader';
import { Heading } from './shared';

export default function StaffProfilePage() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffApi.profile()
      .then((data) => { setProfile(data); setFullName(data.user.fullName); setPhone(data.user.phoneNumber ?? ''); setAvatar(data.user.avatarUrl ?? ''); })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await staffApi.updateProfile({ fullName: fullName.trim(), phoneNumber: phone.trim(), avatarUrl: avatar });
      updateUser({ fullName: fullName.trim(), avatarUrl: avatar || undefined });
      setNotice('Đã cập nhật hồ sơ');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="staff-page">
      <Heading eyebrow="TÀI KHOẢN" title="Hồ sơ nhân viên" />
      {error && <p className="staff-error" role="alert">{error}</p>}
      {notice && <p className="staff-notice">{notice}</p>}
      {profile && (
        <>
          <div className="staff-profile-hero">
            <span className="staff-profile-avatar" aria-hidden="true">{avatar ? <img src={avatar} alt="" /> : profile.user.fullName.charAt(0).toLocaleUpperCase('vi-VN')}</span>
            <div>
              <h2>{profile.user.fullName}</h2>
              <p>{profile.user.email}</p>
              <span className="staff-profile-chip">{profile.employee.employeeRole} · {profile.employee.employeeCode}</span>
            </div>
          </div>
          <div className="staff-profile-grid">
            <div className="staff-profile-card">
              <h3>Thông tin công việc</h3>
              <div className="staff-profile-row"><span>Mã nhân viên</span><b>{profile.employee.employeeCode}</b></div>
              <div className="staff-profile-row"><span>Vị trí</span><b>{profile.employee.employeeRole}</b></div>
              <div className="staff-profile-row"><span>Cửa hàng</span><b>{profile.store?.storeName ?? profile.employee.storeId}</b></div>
              {profile.store?.address && <div className="staff-profile-row"><span>Địa chỉ</span><b>{profile.store.address}</b></div>}
              {profile.store?.phone && <div className="staff-profile-row"><span>Điện thoại cửa hàng</span><b>{profile.store.phone}</b></div>}
              <div className="staff-profile-row"><span>Email đăng nhập</span><b>{profile.user.email}</b></div>
            </div>
            <form className="staff-profile-card staff-form" onSubmit={(event) => void save(event)}>
              <h3>Thông tin cá nhân</h3>
              <AvatarUploader value={avatar} name={fullName} onChange={(image) => setAvatar(image ?? '')} />
              <label>Họ và tên<input required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
              <label>Số điện thoại<input maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <div><button className="staff-btn" type="submit" disabled={saving || !fullName.trim()}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
            </form>
          </div>
        </>
      )}    </section>
  );
}
