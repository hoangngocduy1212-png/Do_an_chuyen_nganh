import { http } from './client';
import { isMockEnabled, unwrapApiResponse } from './client';
import type { Product } from '../types/product';
import { mockProducts, mockStockByStore } from './mock/data';

export interface CartResponse {
  items: Array<{ itemId: string; product: Product; quantity: number; lineTotal: number; priceAtAdd?: number }>;
  totalItems: number;
  totalAmount: number;
}

const MOCK_CART_KEY = 'muadee-mock-cart';
function readMockCart(): CartResponse['items'] {
  try { return JSON.parse(localStorage.getItem(MOCK_CART_KEY) ?? '[]') as CartResponse['items']; }
  catch { return []; }
}
const mockCart: CartResponse['items'] = readMockCart();
function persistMockCart() { localStorage.setItem(MOCK_CART_KEY, JSON.stringify(mockCart)); }

export const cartApi = {
  get: (storeId?: string) => isMockEnabled
    ? Promise.resolve<CartResponse>({ items: mockCart.map((item) => ({ ...item, product: { ...item.product, stock: storeId ? (mockStockByStore[storeId]?.[item.product.productId] ?? item.product.stock) : item.product.stock } })), totalItems: mockCart.reduce((sum, item) => sum + item.quantity, 0), totalAmount: mockCart.reduce((sum, item) => sum + item.lineTotal, 0) })
    : http.get<{ success: true; data: CartResponse }>('/cart', { params: storeId ? { storeId } : undefined }).then(unwrapApiResponse),
  add: async (productId: string, quantity: number) => {
    if (isMockEnabled) {
      const product = mockProducts.find((item) => item.productId === productId);
      if (!product) throw new Error('Không tìm thấy sản phẩm');
      const line = mockCart.find((item) => item.product.productId === productId);
      if (line) {
        line.quantity += quantity;
        line.lineTotal = (line.product.salePrice ?? line.product.price) * line.quantity;
        persistMockCart();
      }
      else { mockCart.push({ itemId: `mock-cart-${productId}`, product, quantity, lineTotal: (product.salePrice ?? product.price) * quantity, priceAtAdd: product.salePrice ?? product.price }); persistMockCart(); }
      return { productId, quantity };
    }
    return http.post<{ success: true; data: unknown }>('/cart/items', { productId, quantity }).then(unwrapApiResponse);
  },
  update: async (itemId: string, quantity: number) => {
    if (isMockEnabled) {
      const line = mockCart.find((item) => item.itemId === itemId);
      if (!line) throw new Error('Không tìm thấy sản phẩm trong giỏ');
      line.quantity = quantity;
      line.lineTotal = (line.product.salePrice ?? line.product.price) * quantity;
      persistMockCart();
      return line;
    }
    return http.patch<{ success: true; data: unknown }>(`/cart/items/${itemId}`, { quantity }).then(unwrapApiResponse);
  },
  remove: async (itemId: string) => {
    if (isMockEnabled) {
      const index = mockCart.findIndex((item) => item.itemId === itemId);
      if (index >= 0) mockCart.splice(index, 1);
      persistMockCart();
      return;
    }
    await http.delete(`/cart/items/${itemId}`);
  },
  clear: async () => {
    if (isMockEnabled) { mockCart.splice(0, mockCart.length); persistMockCart(); return; }
    await http.delete('/cart');
  },
};