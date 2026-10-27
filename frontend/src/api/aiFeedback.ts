import { http, isMockEnabled } from './client';

export const aiFeedbackApi = {
  send: (body: { feedbackType: 'RECOMMENDATION' | 'CHATBOT'; productId?: string; messageId?: string; isHelpful: boolean }) =>
    isMockEnabled ? Promise.resolve() : http.post('/ai-feedback', body).then(() => undefined),
};