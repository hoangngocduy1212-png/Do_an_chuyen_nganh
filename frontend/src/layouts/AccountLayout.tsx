import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountSidebar } from '../components/account/AccountSidebar';
import { membershipsApi } from '../api/memberships';
import { usersApi } from '../api/users';
import { useAuth } from '../store/AuthContext';
import type { MembershipSummary, UserProfile } from '../types/user';

export default function AccountLayout() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([usersApi.me().then((value) => ({ value, failed: false })).catch(() => ({ value: null, failed: true })), membershipsApi.me().then((value) => ({ value, failed: false })).catch(() => ({ value: null, failed: true }))]).then(([profileResult, membershipResult]) => {
      if (!active) return;
      setProfileError(profileResult.failed);
      setMembershipError(membershipResult.failed);
      if (profileResult.value) { setProfile(profileResult.value); updateUser(profileResult.value); }
      if (membershipResult.value) setMembership(membershipResult.value);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [location.pathname]);
  if (!user) return null;
  return <div className="customer-shell account-page">
    <div className="account-page-heading"><span className="section-eyebrow">KHÔNG GIAN THÀNH VIÊN</span><h1>Tài khoản của tôi</h1></div>
    <div className="account-layout-grid"><AccountSidebar user={profile ?? user} membership={membership} /><div className="account-content"><AnimatePresence mode="wait" initial={false}><motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}><Outlet context={{ profile, setProfile, membership, setMembership, profileError, setProfileError, membershipError, setMembershipError }} /></motion.div></AnimatePresence></div></div>
  </div>;
}