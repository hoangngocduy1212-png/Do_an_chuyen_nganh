import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowRight, Award, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { MembershipSummary } from '../../types/user';

export function MembershipCard({ membership }: { membership: MembershipSummary }) {
  const reduceMotion = useReducedMotion();
  const points = useMotionValue(reduceMotion ? membership.pointBalance : 0);
  const pointLabel = useTransform(points, (value) => Math.round(value).toLocaleString('vi-VN'));
  useEffect(() => {
    const controls = animate(points, membership.pointBalance, { duration: reduceMotion ? 0 : .55, ease: 'easeOut' });
    return () => controls.stop();
  }, [membership.pointBalance, points, reduceMotion]);
  const levels = [...(membership.levels ?? [])].sort((a, b) => a.minPoints - b.minPoints);
  const currentIndex = levels.findIndex((level) => level.name === membership.memberLevel);
  const nextLevel = levels[currentIndex + 1];
  const lifetimePoints = membership.lifetimePoints ?? membership.pointBalance;
  const currentThreshold = levels[Math.max(currentIndex, 0)]?.minPoints ?? 0;
  const progress = nextLevel ? Math.min(100, Math.max(0, ((lifetimePoints - currentThreshold) / (nextLevel.minPoints - currentThreshold)) * 100)) : 100;
  return <section className="membership-card">
    <div className="membership-topline"><span><Award size={16} /> MUADEE MEMBER</span><Sparkles size={18} aria-hidden="true" /></div>
    <div className="membership-level-row"><div><small>HẠNG THÀNH VIÊN</small><h2>{membership.memberLevel}</h2></div><div className="membership-points"><small>ĐIỂM KHẢ DỤNG</small><strong><motion.span>{pointLabel}</motion.span></strong></div></div>
    <div className="membership-code">Mã thành viên <strong>{membership.memberCode ?? 'Đang cập nhật'}</strong></div>
    {nextLevel ? <div className="membership-progress"><div className="membership-progress-track"><motion.span initial={{ scaleX: reduceMotion ? 1 : 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduceMotion ? 0 : .8, ease: 'easeOut' }} style={{ width: `${progress}%`, transformOrigin: 'left' }} /></div><p>Còn {Math.max(0, nextLevel.minPoints - lifetimePoints).toLocaleString('vi-VN')} điểm để lên hạng {nextLevel.name}</p></div> : levels.length > 0 && currentIndex === levels.length - 1 ? <p className="membership-top-rank">Bạn đang ở hạng cao nhất</p> : <p className="membership-top-rank">Tiến độ hạng thành viên đang được cập nhật</p>}
    <Link to="/profile/rewards?tab=points" className="membership-link">Xem ưu đãi & lịch sử điểm <ArrowRight size={16} /></Link>
  </section>;
}