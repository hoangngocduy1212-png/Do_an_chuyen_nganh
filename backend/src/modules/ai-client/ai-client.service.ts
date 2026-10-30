import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiChatRequest {
  sessionId: string;
  message: string;
  storeId?: string;
  history: Array<{ role: string; content: string }>;
  customerContext?: Record<string, unknown>;
}

export interface AiChatResponse {
  answer: string;
  sources: string[];
  needHandover: boolean;
}

export interface AiRecommendRequest {
  customerId?: string;
  placement: 'home' | 'product' | 'cart';
  productId?: string;
  storeId: string;
  limit: number;
}

export interface AiRecommendResponse {
  items: Array<{ productId: string; score: number; reason?: string }>;
  strategy: string;
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly config: ConfigService) {}

  chat(body: AiChatRequest): Promise<AiChatResponse> {
    return this.post<AiChatResponse>('/chat', body);
  }

  recommend(body: AiRecommendRequest): Promise<AiRecommendResponse> {
    return this.post<AiRecommendResponse>('/recommend', body);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ai = this.config.get<{ url: string; timeoutMs: number; internalKey: string }>('ai')!;
    const response = await fetch(`${ai.url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': ai.internalKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ai.timeoutMs),
    }).catch((error: unknown) => {
      this.logger.warn(`AI service ${path} unreachable: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
    if (!response.ok) {
      this.logger.warn(`AI service ${path} responded ${response.status}`);
      throw new Error(`AI service error ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
