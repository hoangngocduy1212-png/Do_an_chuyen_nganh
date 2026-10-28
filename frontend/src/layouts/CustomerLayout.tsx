import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Bot, Check, MessageCircle, Sparkles, MapPin, Phone } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Header } from '../components/common/Header';
import { ChatWidget } from '../components/chat/ChatWidget';

export function CustomerLayout() {
  const [chatOpen, setChatOpen] = useState(false);
  const [resumeSessionId, setResumeSessionId] = useState<string>();
  const [toast, setToast] = useState('');
  useEffect(() => {
    const openChat = () => setChatOpen(true);
    const resumeChat = (event: Event) => {
      const sessionId = (event as CustomEvent<{ sessionId: string }>).detail.sessionId;
      setResumeSessionId(sessionId);
      setChatOpen(true);
    };
    const closeChat = () => setChatOpen(false);
    const showToast = (event: Event) => {
      setToast((event as CustomEvent<string>).detail);
      window.setTimeout(() => setToast(''), 2600);
    };
    window.addEventListener('muadee:open-chat', openChat);
    window.addEventListener('muadee:resume-chat', resumeChat);
    window.addEventListener('muadee:close-chat', closeChat);
    window.addEventListener('muadee:toast', showToast);
    return () => {
      window.removeEventListener('muadee:open-chat', openChat);
      window.removeEventListener('muadee:resume-chat', resumeChat);
      window.removeEventListener('muadee:close-chat', closeChat);
      window.removeEventListener('muadee:toast', showToast);
    };
  }, []);
  return <MotionConfig reducedMotion="user"><div className="customer-layout">
    <Header onOpenChat={() => { window.dispatchEvent(new Event('muadee:close-store-selector')); setChatOpen(true); }} />
    <main className="customer-main"><Outlet /></main>
    <footer className="site-footer"><div className="customer-shell footer-main"><div className="footer-brand"><a href="/" className="muadee-brand"><span className="brand-mark"><span /></span><span>muadee<small>tươi ngon mỗi ngày</small></span></a><p>Mua sắm thực phẩm tươi ngon, tiện lợi cho mọi gia đình.</p></div><div><h3>Cửa hàng Muadee</h3><span><MapPin size={14} /> Chi nhánh Nguyễn Trãi, Q.5</span><span><MapPin size={14} /> Chi nhánh Võ Văn Tần, Q.3</span><span><MapPin size={14} /> Chi nhánh Phan Xích Long</span></div><div><h3>Chính sách</h3><a href="/policies/delivery">Chính sách giao nhận</a><a href="/policies/returns">Chính sách đổi trả</a></div><div><h3>Chăm sóc khách hàng</h3><a className="footer-hotline" href="tel:1900636789"><Phone size={15} /> 1900 636 789</a><small>Hỗ trợ mỗi ngày, 8:00–21:00</small></div></div><div className="footer-bottom"><div className="customer-shell">© 2026 Muadee. Tươi ngon mỗi ngày.</div></div></footer>
    <button className={`chat-launcher ${chatOpen ? 'active' : ''}`} type="button" aria-label="Hỏi Muadee AI" onClick={() => { window.dispatchEvent(new Event('muadee:close-store-selector')); setChatOpen(true); }}><span className="chat-launcher-icon"><MessageCircle size={21} /><Sparkles size={11} /></span><span>Hỏi Muadee AI</span></button>
    <ChatWidget open={chatOpen} resumeSessionId={resumeSessionId} onClose={() => { setChatOpen(false); setResumeSessionId(undefined); }} />
    {toast && <div className="customer-toast" role="status" aria-live="polite"><Check size={16} />{toast}</div>}
  </div></MotionConfig>;
}
