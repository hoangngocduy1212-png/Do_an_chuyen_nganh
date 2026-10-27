import type { Product } from '../types/product';
import { mockProducts, mockStockByStore } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export interface HomeRecommendations {
  personalized: Product[];
  bestSellers: Product[];
  coldStart: boolean;
}

const available = (products: Product[]) => products.filter((product) => product.status === 'ACTIVE' && product.stock > 0);
const mockForStore = (storeId: string) => mockProducts.map((product) => ({ ...product, stock: mockStockByStore[storeId]?.[product.productId] ?? product.stock }));
const mockBestSellers = (storeId: string) => available(mockForStore(storeId)).slice(0, 4);

export const recommendationsApi = {
  product: async (storeId: string, fallbackProducts: Product[] = []): Promise<Product[]> => {
    if (isMockEnabled) return available(mockForStore(storeId)).slice(2, 6);
    try {
      const payload = await http.get<{ success: true; data: Array<Product | { productId: string }> | { items?: Array<Product | { productId: string }> } }>('/recommendations', { params: { placement: 'product', storeId } }).then(unwrapApiResponse);
      const items = Array.isArray(payload) ? payload : payload.items ?? [];
      return available(items.flatMap((item) => 'status' in item ? [item] : fallbackProducts.filter((product) => product.productId === item.productId)));
    } catch {
      return available(fallbackProducts).slice(0, 4);
    }
  },
  home: async (storeId: string, customerId?: string, fallbackProducts: Product[] = []): Promise<HomeRecommendations> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_RECOMMENDATION_ERROR === 'true') {
        const bestSellers = available(fallbackProducts).slice(0, 4);
        return { personalized: [], bestSellers: bestSellers.length ? bestSellers : mockBestSellers(storeId), coldStart: true };
      }
      const items = available(mockForStore(storeId));
      return customerId
        ? { personalized: items.slice(2, 6), bestSellers: items.slice(0, 4), coldStart: false }
        : { personalized: [], bestSellers: mockBestSellers(storeId), coldStart: true };
    }
    const request = http.get<{ success: true; data: Array<Product | { productId: string }> | { items?: Array<Product | { productId: string }>; personalizedItems?: Array<Product | { productId: string }>; bestSellerItems?: Array<Product | { productId: string }>; coldStart?: boolean; strategy?: string } }>('/recommendations', { params: { placement: 'home', storeId } }).then(unwrapApiResponse);
    const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('recommendation-timeout')), 3000));
    try {
      const payload = await Promise.race([request, timeout]);
      const result = Array.isArray(payload) ? { items: payload } : payload;
      const resolveProducts = (items: Array<Product | { productId: string }> = []) => available(items.flatMap((item) => {
        if ('status' in item) return [item];
        const product = fallbackProducts.find((candidate) => candidate.productId === item.productId);
        return product ? [product] : [];
      }));
      const isColdStart = Boolean(result.coldStart || result.strategy?.toLowerCase().includes('cold-start') || !customerId);
      const personalized = isColdStart ? [] : resolveProducts(result.personalizedItems ?? result.items ?? []);
      const bestSellers = result.bestSellerItems
        ? resolveProducts(result.bestSellerItems)
        : isColdStart && result.items?.length
          ? resolveProducts(result.items)
          : available(fallbackProducts).slice(0, 4);
      return { personalized, bestSellers, coldStart: Boolean(isColdStart || !personalized.length) };
    } catch {
      const bestSellers = fallbackProducts.length ? available(fallbackProducts).slice(0, 4) : mockBestSellers(storeId);
      return { personalized: [], bestSellers, coldStart: true };
    }
  },
};