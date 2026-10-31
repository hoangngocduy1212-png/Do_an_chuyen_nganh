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

  chat(body: AiChatRequest): Promise<AiChatResponse> {
    return this.post<AiChatResponse>('/chat', body);
  }

  recommend(body: AiRecommendRequest): Promise<AiRecommendResponse> {
    return this.post<AiRecommendResponse>('/recommend', body);
  }

  async analyzeImages(files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>, message: string, storeId?: string): Promise<AiImageResponse> {
    const ai = this.config.get<{ url: string; timeoutMs: number; internalKey: string }>('ai')!;
    const form = new FormData();
    for (const file of files) form.append('images', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    form.append('message', message);
    if (storeId) form.append('storeId', storeId);
    const response = await fetch(`${ai.url}/image/analyze`, {
      method: 'POST',
      headers: { 'X-Internal-Key': ai.internalKey },
      body: form,
      signal: AbortSignal.timeout(Math.max(ai.timeoutMs, 240_000)),
    });
    if (!response.ok) throw new Error(`AI service error ${response.status}`);
    return (await response.json()) as AiImageResponse;
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
