import type { Product } from './product';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'staff';
  content: string;
  products?: Product[];
  loginRequired?: boolean;
}

export interface ChatResult {
  answer: string;
  sources?: string[];
  needHandover?: boolean;
  messageId?: string;
  message?: ChatMessage;
  products?: Product[];
  messages?: ChatMessage[];
  status?: ChatSession['status'];
  agentName?: string;
}

export interface ChatSession {
  sessionId: string;
  status: 'AI_CHATTING' | 'HANDED_OVER' | 'CLOSED';
  agentName?: string;
  messages?: ChatMessage[];
}

export interface ChatHistory {
  messages: ChatMessage[];
  status: ChatSession['status'];
  agentName?: string;
}