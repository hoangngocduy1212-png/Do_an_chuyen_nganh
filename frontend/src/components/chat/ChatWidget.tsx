import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, ImagePlus, Minimize2, Send, ThumbsDown, ThumbsUp, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiFeedbackApi } from '../../api/aiFeedback';
import { cartApi } from '../../api/cart';
import { chatApi } from '../../api/chat';
import type { ChatMessage, ChatSession } from '../../types/chat';
import { useAuth } from '../../store/AuthContext';
import { cartStore } from '../../store/cartStore';
import { useStoreSelection, storeSelectionStore } from '../../store/storeSelectionStore';
import { storesApi } from '../../api/stores';
import { ProductImage } from '../product/ProductImage';
import type { Product } from '../../types/product';

const MAX_IMAGES = 4;
const GREETING = 'Xin chào! Mình có thể giúp bạn tìm sản phẩm, xem khuyến mãi và chính sách giao nhận.';
const QUICK_PROMPTS = [
  'Nguyên liệu nấu canh chua',
  'Có voucher nào đang áp dụng?',
  'Chính sách giao hàng và nhận tại cửa hàng',
  'Tra cứu đơn hàng của tôi',
];

function newMessage(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: crypto.randomUUID(), role, content, ...extra };
}

export function ChatWidget({ open, onClose, resumeSessionId }: { open: boolean; onClose: () => void; resumeSessionId?: string }) {
  const { user } = useAuth();
  const { storeId } = useStoreSelection();
  useEffect(() => {
    storesApi.list().then((stores) => {
      if (stores.length && !stores.some((store) => store._id === storeId)) storeSelectionStore.setStore(stores[0]._id);
    }).catch(() => undefined);
  }, [storeId]);
  const [messages, setMessages] = useState<ChatMessage[]>([newMessage('assistant', GREETING)]);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [handoverPending, setHandoverPending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<Array<{ file: File; url: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function closeChat() {
    setSession(null);
    setMessages([newMessage('assistant', GREETING)]);
    setFeedbackGiven([]);
    setValue('');
    setMinimized(false);
    onClose();
  }

  useEffect(() => {
    if (open) return;
    setSession(null);
    setMessages([newMessage('assistant', GREETING)]);
    setFeedbackGiven([]);
    setValue('');
    setMinimized(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMinimized(false);
    inputRef.current?.focus();
    if (session || creating) return;
    setCreating(true);
    const openSession = resumeSessionId
      ? chatApi.history(resumeSessionId).then((history) => ({ sessionId: resumeSessionId, status: history.status, agentName: history.agentName, messages: history.messages }))
      : chatApi.createSession();
    openSession
      .then((created) => { setSession(created); setMessages(created.messages?.length ? created.messages : [newMessage('assistant', GREETING)]); })
      .catch(() => undefined)
      .finally(() => setCreating(false));
  }, [open, session, creating, resumeSessionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, minimized, sending]);
  useEffect(() => { if (open && !minimized) inputRef.current?.focus(); }, [open, minimized]);

  useEffect(() => {
    if (!open || minimized || !session || session.status !== 'HANDED_OVER') return;
    const timer = window.setInterval(() => {
      chatApi.poll(session.sessionId).then((updated) => {
        setSession((current) => current ? { ...current, status: updated.status, agentName: updated.agentName } : current);
        if (updated.messages.length) {
          setMessages((current) => {
            const knownIds = new Set(current.map((message) => message.id));
            const fresh = updated.messages.filter((message) => !knownIds.has(message.id));
            return fresh.length ? [...current, ...fresh] : current;
          });
        }
      }).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, minimized, session?.sessionId, session?.status]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && open) { event.stopPropagation(); closeChat(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  async function submitMessage(content: string) {
    const message = content.trim();
    if (sending || !session) return;
    if (pendingImages.length) {
      const sent = pendingImages;
      setPendingImages([]);
      setValue('');
      setMessages((current) => [...current, newMessage('user', message || 'Tìm sản phẩm giống ảnh', { images: sent.map((item) => item.url) })]);
      setSending(true);
      try {
        const response = await chatApi.sendImages(session.sessionId, sent.map((item) => item.file), message, storeId);
        setMessages((current) => [...current, newMessage('assistant', response.answer, { id: response.messageId ?? crypto.randomUUID(), products: response.products ?? [] })]);
        if (response.status || response.needHandover) setSession((s) => s ? { ...s, status: response.status ?? 'HANDED_OVER' } : s);
      } catch {
        setMessages((current) => [...current, newMessage('assistant', 'Trợ lý chưa phân tích được ảnh, bạn có muốn chuyển sang nhân viên CSKH không?', { id: `error-${crypto.randomUUID()}` })]);
      } finally { setSending(false); }
      return;
    }
    if (!message) return;
    setMessages((current) => [...current, newMessage('user', message)]);
    setValue('');
    if (message.toLocaleLowerCase('vi').includes('tra cứu đơn hàng') && user?.role !== 'CUSTOMER') {
      setMessages((current) => [...current, newMessage('assistant', 'Bạn cần đăng nhập để tra cứu đơn hàng.', { loginRequired: true })]);
      return;
    }
    setSending(true);
    try {
      const response = await chatApi.sendMessage(session.sessionId, message, storeId);
      const responseMessage = response.message;
      const answer = responseMessage?.content ?? response.answer ?? 'Mình chưa có câu trả lời phù hợp. Bạn có thể hỏi mình về sản phẩm hoặc giao nhận.';
      const products = response.products ?? responseMessage?.products ?? [];
      setMessages((current) => [...current, newMessage('assistant', answer, {
        id: response.messageId ?? responseMessage?.id ?? crypto.randomUUID(),
        products,
      })]);
      if (response.status || response.needHandover) setSession((current) => current ? { ...current, status: response.status ?? 'HANDED_OVER' } : current);
    } catch {
      setMessages((current) => [...current, newMessage('assistant', 'Trợ lý đang bận, bạn có muốn chuyển sang nhân viên CSKH không?', { id: `error-${crypto.randomUUID()}` })]);
    } finally { setSending(false); }
  }

  function onPickImages(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []).filter((file) => file.size <= 5 * 1024 * 1024);
    event.target.value = '';
    setPendingImages((current) => [...current, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES));
  }

  function removeImage(index: number) {
    setPendingImages((current) => current.filter((_, i) => i !== index));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(value);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage(value); }
  }

  async function requestHandover() {
    if (!session || handoverPending || session.status === 'HANDED_OVER') return;
    setHandoverPending(true);
    setSession((current) => current ? { ...current, status: 'HANDED_OVER' } : current);
    try {
      const updated = await chatApi.handover(session.sessionId);
      setSession((current) => current ? { ...current, ...updated } : updated);
    } catch {
      setSession((current) => current ? { ...current, status: 'AI_CHATTING' } : current);
    } finally { setHandoverPending(false); }
  }

  async function sendFeedback(messageId: string, isHelpful: boolean) {
    if (!user || feedbackGiven.includes(messageId)) return;
    try {
      await aiFeedbackApi.send({ feedbackType: 'CHATBOT', messageId, isHelpful });
      setFeedbackGiven((current) => [...current, messageId]);
    } catch { /* Feedback is optional and should never interrupt the chat. */ }
  }

  async function addSuggestedProduct(product: Product) {
    if (user?.role !== 'CUSTOMER') {
      localStorage.setItem('muadee-pending-cart-product', product.productId);
      window.dispatchEvent(new Event('muadee:login-required'));
      return;
    }
    try {
      await cartApi.add(product.productId, 1, storeId);
      cartStore.add(product);
      window.dispatchEvent(new Event('muadee:cart-added'));
      window.dispatchEvent(new CustomEvent('muadee:toast', { detail: 'Đã thêm vào giỏ hàng' }));
    } catch { /* A failed cart request leaves the local cart unchanged. */ }
  }

  const agentName = session?.agentName;
  const handedOver = session?.status === 'HANDED_OVER';

  return <AnimatePresence>{open && <motion.aside className={`chat-panel ${minimized ? 'is-minimized' : ''}`} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={{ duration: .18 }} aria-label="Trợ lý Muadee AI">
    <div className="chat-header"><span className="chat-avatar"><Bot size={21} /></span><div><strong>Trợ lý Muadee AI</strong><small>{agentName ? `Nhân viên ${agentName} đã tham gia` : handedOver ? 'Đang kết nối nhân viên hỗ trợ' : 'Đang sẵn sàng hỗ trợ'}</small></div><button className="icon-button" type="button" aria-label={minimized ? 'Mở rộng trò chuyện' : 'Thu nhỏ trò chuyện'} onClick={() => setMinimized((value) => !value)}>{minimized ? <ChevronDown size={18} /> : <Minimize2 size={17} />}</button><button className="icon-button" type="button" aria-label="Đóng trò chuyện" onClick={closeChat}><X size={19} /></button></div>
    {!minimized && <>
      {handedOver && <div className={`handover-banner ${agentName ? 'joined' : ''}`} role="status">{agentName ? `Nhân viên ${agentName} đã tham gia` : 'Đang chuyển cho nhân viên chăm sóc khách hàng, vui lòng chờ trong giây lát'}</div>}
      <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>
          {message.role === 'staff' && <span className="chat-role-label"><UserRound size={12} /> Nhân viên</span>}
          {message.images?.length ? <div className="chat-attachments">{message.images.map((src) => <img key={src} src={src} alt="Ảnh đã gửi" />)}</div> : null}
          <p>{message.content}</p>
          {message.loginRequired && <Link className="chat-login-link" to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Đăng nhập</Link>}
          {message.products?.length ? <div className="chat-product-list">{message.products.filter((product) => product.status === 'ACTIVE' && product.stock > 0).map((product) => <article className="chat-product-card" key={product.productId}><Link to={`/products/${product.productId}`} onClick={() => setMinimized(true)}><ProductImage src={product.image} alt={product.productName} /></Link><div><Link to={`/products/${product.productId}`} onClick={() => setMinimized(true)}><strong>{product.productName}</strong></Link><small>{product.price.toLocaleString('vi-VN')}đ/{product.unit}</small><button type="button" onClick={() => void addSuggestedProduct(product)}>Thêm vào giỏ</button></div></article>)}</div> : null}
          {message.role === 'assistant' && user?.role === 'CUSTOMER' && <div className="chat-message-feedback"><span>Hữu ích?</span><button type="button" aria-label="Câu trả lời hữu ích" disabled={feedbackGiven.includes(message.id)} onClick={() => void sendFeedback(message.id, true)}><ThumbsUp size={13} /></button><button type="button" aria-label="Câu trả lời chưa hữu ích" disabled={feedbackGiven.includes(message.id)} onClick={() => void sendFeedback(message.id, false)}><ThumbsDown size={13} /></button></div>}
          {message.content.includes('có muốn chuyển sang nhân viên') && <button className="inline-handover" type="button" onClick={() => void requestHandover()}>Chuyển nhân viên</button>}
        </div>)}
        {messages.length === 1 && <div className="chat-quick-prompts">{QUICK_PROMPTS.map((prompt) => <button type="button" key={prompt} onClick={() => void submitMessage(prompt)}>{prompt}</button>)}</div>}
        {(sending || creating) && <div className="chat-message assistant typing-indicator" aria-label={creating ? 'Đang mở phiên trò chuyện' : 'Đang trả lời'}><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-disclaimer">Trợ lý AI có thể chưa chính xác. Vui lòng kiểm tra lại thông tin quan trọng.</div>
      {pendingImages.length > 0 && <div className="chat-attachments pending">{pendingImages.map((item, index) => <span key={item.url}><img src={item.url} alt="Ảnh đính kèm" /><button type="button" aria-label="Bỏ ảnh" onClick={() => removeImage(index)}><X size={12} /></button></span>)}</div>}
      <form className="chat-composer" onSubmit={submit}><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPickImages} /><button type="button" className="chat-attach" aria-label="Đính kèm ảnh" disabled={sending || creating || !session || pendingImages.length >= MAX_IMAGES} onClick={() => fileRef.current?.click()}><ImagePlus size={18} /></button><textarea ref={inputRef} aria-label="Tin nhắn" placeholder={pendingImages.length ? 'Bạn muốn hỏi gì về ảnh này?' : 'Bạn muốn tìm món gì?'} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onComposerKeyDown} rows={1} /><button type="submit" disabled={sending || creating || (!value.trim() && !pendingImages.length) || !session} aria-label="Gửi tin nhắn"><Send size={18} /></button></form>
      <div className="chat-footer"><button type="button" disabled={!session || handoverPending || handedOver} onClick={() => void requestHandover()}><UserRound size={15} />{handoverPending ? 'Đang chuyển...' : handedOver ? 'Đang kết nối nhân viên' : 'Chuyển nhân viên CSKH'}</button></div>
    </>}
  </motion.aside>}</AnimatePresence>;
}
