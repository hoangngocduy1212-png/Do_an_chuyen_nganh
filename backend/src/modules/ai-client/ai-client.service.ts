import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiChatRequest {
  sessionId: string;
  message: string;
  storeId?: string;
  userId?: string;
  history: Array<{ role: string; content: string }>;
  customerContext?: Record<string, unknown>;
}

export interface AiChatResponse {
  answer: string;
  sources: string[];
  needHandover: boolean;
  productIds?: string[];
}

export interface AiImageResponse {
  answer: string;
  images: Array<{ description: string; ocrText: string; matches: string[] }>;
  productIds: string[];
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

  async chat(body: AiChatRequest): Promise<AiChatResponse> {
    const data = await this.postInternal<{
      reply: string;
      products?: Array<{ id?: string; productId?: string }>;
      needs_human?: boolean;
    }>('/internal/chat/messages', {
      message: body.message,
      history: body.history,
    }, body.userId ?? body.sessionId, undefined, body.storeId);
    return {
      answer: data.reply ?? '',
      sources: [],
      needHandover: Boolean(data.needs_human),
      productIds: (data.products ?? []).map((item) => item.id ?? item.productId ?? '').filter(Boolean),
    };
  }

  recommend(body: AiRecommendRequest): Promise<AiRecommendResponse> {
    return this.post<AiRecommendResponse>('/recommend', body);
  }

  async analyzeImages(
    files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
    message: string,
    storeId?: string,
    userId?: string,
  ): Promise<AiImageResponse> {
    const first = files[0];
    if (!first) throw new Error('Cần ít nhất 1 ảnh');
    const data = await this.postInternal<{
      reply: string;
      products?: Array<{ id?: string; productId?: string }>;
      image?: {
        confidence?: string;
        products?: Array<{ id?: string; productId?: string; name?: string }>;
        detected?: Record<string, unknown> | null;
      };
    }>('/internal/chat/messages', {
      message: message || 'Tôi gửi ảnh này, đây là sản phẩm gì?',
      image_base64: first.buffer.toString('base64'),
    }, userId ?? 'anonymous', Math.max(this.config.get<number>('ai.timeoutMs') ?? 0, 240_000), storeId);
    const imageProducts = data.image?.products ?? data.products ?? [];
    const productIds = imageProducts.map((item) => item.id ?? item.productId ?? '').filter(Boolean);
    return {
      answer: data.reply ?? '',
      images: [{
        description: JSON.stringify(data.image?.detected ?? {}),
        ocrText: '',
        matches: productIds,
      }],
      productIds,
    };
  }

  private async postInternal<T>(path: string, body: unknown, userId: string, timeoutMs?: number, storeId?: string): Promise<T> {
    const ai = this.config.get<{ url: string; timeoutMs: number; internalKey: string }>('ai')!;
    const response = await fetch(`${ai.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': ai.internalKey,
        'X-User-Id': userId,
        ...(storeId ? { 'X-Store-Id': storeId } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs ?? ai.timeoutMs),
    }).catch((error: unknown) => {
      this.logger.warn(`AI service ${path} unreachable: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(`AI service ${path} responded ${response.status}: ${detail.slice(0, 300)}`);
      throw new Error(`AI service error ${response.status}`);
    }
    return (await response.json()) as T;
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
