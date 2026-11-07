import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { staffApi, type Paged, type SupportMessage, type SupportSession } from '../../api/staff';
import { formatDate, Heading, Pager } from './shared';

const LIMIT = 20;

export default function StaffSupportPage() {
  const [data, setData] = useState<Paged<SupportSession>>({ items: [], total: 0, page: 1, limit: LIMIT });
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      setData(await staffApi.supportSessions({ page, limit: LIMIT }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [page]);
  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      setMessages(await staffApi.sessionMessages(id));
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  // Làm mới hội thoại đang mở để thấy tin nhắn mới của khách.
  useEffect(() => {
    if (!active) return undefined;
    void loadMessages(active.sessionId);
    const timer = window.setInterval(() => void loadMessages(active.sessionId), 5000);
    return () => window.clearInterval(timer);
  }, [active, loadMessages]);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }); }, [messages]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const claim = (session: SupportSession) => run(async () => {
    await staffApi.claimSession(session.sessionId);
    setActive(session);
    await loadSessions();
  });
  const send = () => run(async () => {
    if (!active || !text.trim()) return;
    await staffApi.reply(active.sessionId, text.trim());
    setText('');
    await loadMessages(active.sessionId);
  });
  const close = () => run(async () => {
    if (!active) return;
    await staffApi.closeSession(active.sessionId);
    setActive(null);
    setMessages([]);
    await loadSessions();
  });

  return (
    <section className="staff-page">
      <Heading eyebrow="CHĂM SÓC KHÁCH HÀNG" title="Hỗ trợ trực tiếp" />
      {error && <p className="staff-error" role="alert">{error}</p>}
      <div className="staff-split">
        <div>
          <div className="staff-list">
            {data.items.length === 0 && <div className="staff-state">Chưa có khách cần hỗ trợ</div>}
            {data.items.map((session) => (
              <button key={session.sessionId} type="button" disabled={busy}
                className={`staff-list-item ${active?.sessionId === session.sessionId ? 'active' : ''}`}
                onClick={() => void claim(session)}>
                <b>Phiên {session.sessionId.slice(-6)}</b><br />
                <small>{formatDate(session.handoverRequestedAt)} · {session.employeeId ? 'Đã có người nhận' : 'Chưa nhận'}</small>
              </button>
            ))}
          </div>
          <Pager page={data.page} limit={LIMIT} total={data.total} onChange={setPage} />
        </div>
        <div>
          {!active ? <div className="staff-state">Chọn một phiên để tiếp nhận và trả lời.</div> : (
            <>
              <div className="staff-chat">
                {messages.map((message, index) => (
                  <div key={message.messageId ?? message._id ?? index} className={`staff-msg ${message.senderType === 'STAFF' ? 'staff' : ''}`}>{message.content}</div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="staff-reply" onSubmit={(event) => { event.preventDefault(); void send(); }}>
                <input aria-label="Tin nhắn trả lời" maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Nhập tin nhắn..." />
                <button className="staff-btn" type="submit" disabled={busy || !text.trim()}>Gửi</button>
                <button className="staff-btn danger" type="button" disabled={busy} onClick={() => void close()}>Kết thúc</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
