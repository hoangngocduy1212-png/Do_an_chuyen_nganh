import type { ChatHistory, ChatMessage, ChatResult, ChatSession } from '../types/chat';
import { mockProducts } from './mock/data';
import { mockSupportHistory } from './mock/account';
import { http, isMockEnabled, unwrapApiResponse } from './client';

const mockSessions = new Map<string, ChatSession>();
const mockTranscript = new Map<string, ChatMessage[]>();
const delay = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));
const mockStatus = (): ChatSession['status'] => import.meta.env.VITE_MOCK_CHAT_ERROR === 'handover' ? 'HANDED_OVER' : 'AI_CHATTING';

export const chatApi = {
  createSession: async (): Promise<ChatSession> => {
    if (isMockEnabled) {
      const sessionId = crypto.randomUUID();
      const session: ChatSession = { sessionId, status: mockStatus(), startedAt: new Date().toISOString() };
      mockSessions.set(sessionId, session);
      mockTranscript.set(sessionId, []);
      return session;
    }
    return http.post<{ success: true; data: ChatSession }>('/chat/sessions').then(unwrapApiResponse);
  },
  sendMessage: async (sessionId: string, content: string, storeId: string): Promise<ChatResult> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_CHAT_ERROR === 'true') {
        await delay(50);
        throw new Error('Dịch vụ trò chuyện đang bận');
      }
      const transcript = mockTranscript.get(sessionId) ?? [];
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
      const lookupOrder = content.toLocaleLowerCase('vi').includes('đơn hàng');
      const products = content.toLocaleLowerCase('vi').includes('canh chua')
        ? mockProducts.filter((product) => ['p-03', 'p-04'].includes(product.productId))
        : [];
      const answer = lookupOrder
        ? 'Bạn cần đăng nhập để tra cứu đơn hàng.'
        : `Mình sẽ giúp bạn tìm hiểu về "${content}". Đây là một vài sản phẩm phù hợp tại cửa hàng bạn đã chọn.`;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answer,
        products,
        loginRequired: lookupOrder,
      };
      mockTranscript.set(sessionId, [...transcript, userMessage, assistantMessage]);
      const status = mockStatus();
      mockSessions.set(sessionId, { sessionId, status });
      return { answer, messageId: assistantMessage.id, products, status };
    }
    return http.post<{ success: true; data: ChatResult }>(`/chat/sessions/${sessionId}/messages`, { content, storeId }, { timeout: 65000 }).then(unwrapApiResponse);
  },
  sendImages: async (sessionId: string, files: File[], content: string, storeId: string): Promise<ChatResult> => {
    if (isMockEnabled) {
      await delay(600);
      const products = mockProducts.slice(0, 3);
      return { answer: 'Mình thấy ảnh bạn gửi, đây là vài sản phẩm tương tự tại cửa hàng.', messageId: crypto.randomUUID(), products, status: mockStatus() };
    }
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    form.append('content', content);
    if (storeId) form.append('storeId', storeId);
    return http.post<{ success: true; data: ChatResult }>(`/chat/sessions/${sessionId}/images`, form, { timeout: 240000, headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrapApiResponse);
  },
  handover: async (sessionId: string): Promise<ChatSession> => {
    if (isMockEnabled) {
      const next: ChatSession = { sessionId, status: 'HANDED_OVER', agentName: 'Minh Anh' };
      mockSessions.set(sessionId, next);
      await delay(1000);
      window.setTimeout(() => {
        const transcript = mockTranscript.get(sessionId) ?? [];
        mockTranscript.set(sessionId, [...transcript, {
          id: crypto.randomUUID(),
          role: 'staff',
          content: 'Chào bạn, mình là Minh Anh từ bộ phận chăm sóc khách hàng. Mình đang tiếp nhận cuộc trò chuyện và sẵn sàng hỗ trợ bạn.',
        }]);
      }, 1200);
      return next;
    }
    return http.post<{ success: true; data: ChatSession }>(`/chat/sessions/${sessionId}/handover`).then(unwrapApiResponse);
  },
  poll: async (sessionId: string): Promise<ChatHistory> => {
    if (isMockEnabled) {
      const session = mockSessions.get(sessionId) ?? { sessionId, status: 'AI_CHATTING' as const };
      return { messages: mockTranscript.get(sessionId) ?? [], status: session.status, agentName: session.agentName };
    }
    const response = await http.get<{ success: true; data: ChatHistory }>(`/chat/sessions/${sessionId}/messages`).then(unwrapApiResponse);
    return response;
  },
  history: async (sessionId: string): Promise<ChatHistory> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_SUPPORT_ERROR === 'true') throw new Error('Không tải được cuộc trò chuyện');
      const session = mockSupportHistory.find((item) => item.sessionId === sessionId) ?? mockSessions.get(sessionId);
      if (!session) throw new Error('Không tìm thấy cuộc trò chuyện');
      return { messages: session.messages ?? mockTranscript.get(sessionId) ?? [], status: session.status, agentName: session.agentName };
    }
    return http.get<{ success: true; data: ChatHistory }>(`/chat/sessions/${sessionId}/messages`).then(unwrapApiResponse);
  },
  myHistory: async (): Promise<ChatSession[]> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_SUPPORT_ERROR === 'true') throw new Error('Không tải được lịch sử hỗ trợ');
      return import.meta.env.VITE_MOCK_SUPPORT_EMPTY === 'true' ? [] : [...mockSupportHistory].sort((a, b) => Date.parse(b.startedAt ?? '') - Date.parse(a.startedAt ?? ''));
    }
    return http.get<{ success: true; data: ChatSession[] }>('/chat/sessions/my').then(unwrapApiResponse);
  },
};
