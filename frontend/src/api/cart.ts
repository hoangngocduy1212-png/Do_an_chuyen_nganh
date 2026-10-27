import { http } from './client';
import { isMockEnabled, unwrapApiResponse } from './client';
import type { Product } from '../types/product';
import { mockProducts } from './mock/data';

export interface CartResponse {
  items: Array<{ itemId: string; product: Product; quantity: number; lineTotal: number }>;
  totalItems: number;
  totalAmount: number;
}

const mockCart: CartResponse['items'] = [];

export const cartApi = {
  get: () => isMockEnabled
    ? Promise.resolve<CartResponse>({ items: [...mockCart], totalItems: mockCart.reduce((sum, item) => sum + item.quantity, 0), totalAmount: mockCart.reduce((sum, item) => sum + item.lineTotal, 0) })
    : http.get<{ success: true; data: CartResponse }>('/cart').then(unwrapApiResponse),
  add: async (productId: string, quantity: number) => {
    if (isMockEnabled) {
      const product = mockProducts.find((item) => item.productId === productId);
      if (!product) throw new Error('Không tìm thấy sản phẩm');
      const line = mockCart.find((item) => item.product.productId === productId);
      if (line) {
        line.quantity += quantity;
        line.lineTotal = line.product.price * line.quantity;
      }
      else mockCart.push({ itemId: `mock-cart-${productId}`, product, quantity, lineTotal: product.price * quantity });
      return { productId, quantity };
    }
    return http.post<{ success: true; data: unknown }>('/cart/items', { productId, quantity }).then(unwrapApiResponse);
  },
};