import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, MessageCircle, MessageSquareText, RotateCw } from 'lucide-react';
import { chatApi } from '../../../api/chat';
import type { ChatHistory, ChatSession } from '../../../types/chat';

export default function SupportHistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [selected, setSelected] = useState<ChatSession | null>(null);
  const [transcript, setTranscript] = useState<ChatHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const navigate = useNavigate();
  async function loadSessions() { setLoading(true); setListError(false); try { setSessions(await chatApi.myHistory()); } catch { setListError(true); } finally { setLoading(false); } }
  useEffect(() => { void loadSessions(); }, []);
  async function openSession(session: ChatSession) {
    setSelected(session); setTranscript(null); setDetailError(false); setDetailLoading(true);
    try { setTranscript(await chatApi.history(session.sessionId)); } catch { setDetailError(true); }
    finally { setDetailLoading(false); }
  }
  function startSupport() { window.dispatchEvent(new Event('muadee:close-store-selector')); window.dispatchEvent(new Event('muadee:open-chat')); navigate('/profile/support'); }
  function continueSession(sessionId: string) { window.dispatchEvent(new CustomEvent('muadee:resume-chat', { detail: { sessionId } })); }
  const lastMessage = (session: ChatSession) => session.lastMessage ?? session.messages?.at(-1);
  const statusText = (session: ChatSession) => session.status === 'CLOSED' ? 'Đã đóng' : session.status === 'AI_CHATTING' ? 'Trợ lý AI' : session.agentName ? `Đã chuyển nhân viên · ${session.agentName}` : 'Đang chờ nhân viên';
  return <section className="account-panel"><header className="account-panel-heading"><div><span className="section-eyebrow">CHĂM SÓC KHÁCH HÀNG</span><h2>{selected ? 'Nội dung trò chuyện' : 'Lịch sử hỗ trợ'}</h2></div>{selected ? <button className="account-outline-button" type="button" onClick={() => { setSelected(null); setTranscript(null); }}><ArrowLeft size={16} /> Quay lại</button> : <button className="account-outline-button" type="button" onClick={startSupport}><MessageCircle size={16} /> Hỏi Muadee AI</button>}</header>
    {selected ? <div className="support-detail"><div className="support-detail-meta"><span>{selected.startedAt ? new Date(selected.startedAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Thời gian đang cập nhật'}</span><span className={`support-status support-status-${selected.status.toLowerCase()}`}>{statusText(selected)}</span></div>{detailLoading ? <div className="account-loading"><LoaderCircle size={17} className="account-spinner" /> Đang tải nội dung trò chuyện...</div> : detailError ? <div className="account-error" role="alert"><span>Không tải được dữ liệu cuộc trò chuyện.</span><button type="button" onClick={() => void openSession(selected)}><RotateCw size={14} /> Thử lại</button></div> : <><div className="support-transcript" aria-live="polite">{transcript?.messages.length ? transcript.messages.map((message) => <article className={`support-message support-message-${message.role}`} key={message.id}><span>{message.role === 'user' ? 'Khách hàng' : message.role === 'staff' ? selected.agentName ? `Nhân viên ${selected.agentName}` : 'Nhân viên' : 'Chatbot'}</span><p>{message.content}</p></article>) : <div className="account-empty"><MessageSquareText size={24} /><p>Chưa có tin nhắn trong cuộc trò chuyện này.</p></div>}</div>{selected.status !== 'CLOSED' && <button className="primary-button account-small-button support-continue" type="button" onClick={() => continueSession(selected.sessionId)}><MessageCircle size={15} /> Tiếp tục trò chuyện</button>}</>}</div> : loading ? <div className="support-skeleton" aria-label="Đang tải lịch sử hỗ trợ"><i /><i /><i /></div> : listError ? <div className="account-error" role="alert"><span>Không tải được dữ liệu</span><button type="button" onClick={() => void loadSessions()}><RotateCw size={14} /> Thử lại</button></div> : sessions.length ? <div className="support-history-list">{sessions.map((session) => { const latest = lastMessage(session); return <button className="support-session-row" key={session.sessionId} type="button" onClick={() => void openSession(session)}><span className="support-history-icon"><MessageSquareText size={19} /></span><span className="support-session-copy"><strong>{session.agentName ? `Trao đổi với ${session.agentName}` : 'Trò chuyện với Muadee'}</strong><span>{latest?.content ?? 'Cuộc trò chuyện hỗ trợ khách hàng'}</span><small>{session.startedAt ? new Date(session.startedAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Thời gian đang cập nhật'}</small></span><span className={`support-status support-status-${session.status.toLowerCase()}`}>{statusText(session)}</span></button>; })}</div> : <div className="account-empty"><MessageSquareText size={26} /><p>Bạn chưa có cuộc trò chuyện nào</p><button className="primary-button account-small-button" type="button" onClick={startSupport}>Hỏi Muadee AI</button></div>}
  </section>;
}