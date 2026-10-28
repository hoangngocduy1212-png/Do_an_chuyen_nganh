import { http, isMockEnabled, unwrapApiResponse } from './client';
import type { Product } from '../types/product';
import { mockProducts, mockStockByStore } from './mock/data';
import { MockApiError, mockScenario } from './mock/scenarios';

export interface CartLineResponse {
  itemId: string;
  product: Product;
  quantity: number;
  lineTotal: number;
  priceAtAdd?: number;
  stock: number;
  currentPrice: number;
  priceChanged: boolean;
  available: boolean;
}

export interface CartResponse {
  storeId: string;
  items: CartLineResponse[];
  totalItems: number;
  totalAmount: number;
}

export interface CartValidationChange {
  itemId: string;
  productId: string;
  productName: string;
  type: 'UNAVAILABLE' | 'QUANTITY' | 'PRICE';
  message: string;
  availableStock: number;
  currentPrice: number;
  suggestedQuantity: number;
}

export interface CartValidationResponse {
  storeId: string;
  valid: boolean;
  changes: CartValidationChange[];
}

type MockCartLine = { itemId: string; product: Product; quantity: number; lineTotal: number; priceAtAdd?: number };
const MOCK_CART_KEY = 'muadee-mock-cart';
const MOCK_CART_STORE_KEY = 'muadee-mock-cart-store';
const MOCK_CART_MODE_KEY = 'muadee-mock-cart-mode';
const DEFAULT_STORE_ID = 'store-nguyen-trai';

function seedMockCart(): MockCartLine[] {
  const product = (productId: string): Product => {
    const found = mockProducts.find((item) => item.productId === productId);
    if (!found) throw new Error(`Không tìm thấy sản phẩm mock ${productId}`);
    return { ...found };
  };
  const line = (productId: string, quantity: number, priceAtAdd?: number): MockCartLine => {
    const item = product(productId);
    const currentPrice = item.salePrice ?? item.price;
    return { itemId: `mock-cart-${productId}`, product: item, quantity, lineTotal: currentPrice * quantity, priceAtAdd };
  };
  if (mockScenario.cartMode === 'multiple') return [line('p-01', 2), line('p-04', 1), line('p-05', 1)];
  if (mockScenario.cartMode === 'changes') return [line('p-09', 1), line('p-03', 99), line('p-01', 2, 30000)];
  return [];
}

function readMockCart(): MockCartLine[] {
  const stored = localStorage.getItem(MOCK_CART_KEY);
  const previousMode = localStorage.getItem(MOCK_CART_MODE_KEY);
  if (previousMode !== null && previousMode !== mockScenario.cartMode) {
    const seeded = seedMockCart();
    localStorage.setItem(MOCK_CART_MODE_KEY, mockScenario.cartMode);
    localStorage.setItem(MOCK_CART_KEY, JSON.stringify(seeded));
    return seeded;
  }
  if (stored === null) {
    const seeded = seedMockCart();
    localStorage.setItem(MOCK_CART_MODE_KEY, mockScenario.cartMode);
    return seeded;
  }
  try { return JSON.parse(stored) as MockCartLine[]; }
  catch { return seedMockCart(); }
}

const mockCart: MockCartLine[] = readMockCart();
let mockCartStoreId = localStorage.getItem(MOCK_CART_STORE_KEY) ?? DEFAULT_STORE_ID;

function persistMockCart() {
  localStorage.setItem(MOCK_CART_KEY, JSON.stringify(mockCart));
  localStorage.setItem(MOCK_CART_STORE_KEY, mockCartStoreId);
  localStorage.setItem(MOCK_CART_MODE_KEY, mockScenario.cartMode);
}

function lineAtStore(line: MockCartLine, storeId: string): CartLineResponse {
  const currentProduct = mockProducts.find((item) => item.productId === line.product.productId) ?? line.product;
  const stock = mockStockByStore[storeId]?.[line.product.productId] ?? currentProduct.stock;
  const currentPrice = currentProduct.salePrice ?? currentProduct.price;
  return {
    ...line,
    product: { ...currentProduct, stock },
    stock,
    currentPrice,
    priceChanged: line.priceAtAdd !== undefined && line.priceAtAdd !== currentPrice,
    available: stock > 0 && line.quantity <= stock,
    lineTotal: currentPrice * line.quantity,
  };
}

function assertCartAvailable() {
  if (mockScenario.cartMode === 'network-error') throw new MockApiError('Không thể kết nối để tải giỏ hàng.', 'NETWORK');
}

function validateMockCart(storeId: string): CartValidationResponse {
  assertCartAvailable();
  const changes = mockCart.flatMap<CartValidationChange>((line) => {
    const current = lineAtStore(line, storeId);
    if (current.stock <= 0) return [{ itemId: line.itemId, productId: line.product.productId, productName: line.product.productName, type: 'UNAVAILABLE', message: 'Sản phẩm hiện đã hết hàng tại cửa hàng này.', availableStock: 0, currentPrice: current.currentPrice, suggestedQuantity: 0 }];
    if (line.quantity > current.stock) return [{ itemId: line.itemId, productId: line.product.productId, productName: line.product.productName, type: 'QUANTITY', message: `Chỉ còn ${current.stock} sản phẩm tại cửa hàng.`, availableStock: current.stock, currentPrice: current.currentPrice, suggestedQuantity: current.stock }];
    if (current.priceChanged) return [{ itemId: line.itemId, productId: line.product.productId, productName: line.product.productName, type: 'PRICE', message: `Giá hiện tại là ${current.currentPrice.toLocaleString('vi-VN')}đ.`, availableStock: current.stock, currentPrice: current.currentPrice, suggestedQuantity: line.quantity }];
    return [];
  });
  return { storeId, valid: changes.length === 0, changes };
}

export const cartApi = {
  get: async (storeId = mockCartStoreId): Promise<CartResponse> => {
    if (!isMockEnabled) return http.get<{ success: true; data: CartResponse }>('/cart', { params: { storeId } }).then(unwrapApiResponse);
    assertCartAvailable();
    mockCartStoreId = storeId;
    persistMockCart();
    const items = mockCart.map((line) => lineAtStore(line, storeId));
    return { storeId, items, totalItems: items.reduce((sum, item) => sum + item.quantity, 0), totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0) };
  },
  validate: async (storeId: string): Promise<CartValidationResponse> => {
    if (isMockEnabled) return validateMockCart(storeId);
    return http.post<{ success: true; data: CartValidationResponse }>('/cart/validate', { storeId }).then(unwrapApiResponse);
  },
  add: async (productId: string, quantity: number, storeId = mockCartStoreId) => {
    if (isMockEnabled) {
      const product = mockProducts.find((item) => item.productId === productId);
      if (!product) throw new MockApiError('Không tìm thấy sản phẩm.', 'PRODUCT_NOT_FOUND');
      const stock = mockStockByStore[storeId]?.[productId] ?? product.stock;
      const line = mockCart.find((item) => item.product.productId === productId);
      const requestedQuantity = quantity + (line?.quantity ?? 0);
      if (stock <= 0 || quantity <= 0 || requestedQuantity > stock) throw new MockApiError('Sản phẩm không đủ hàng tại cửa hàng đã chọn.', 'OUT_OF_STOCK', [{ productId, requestedQuantity, availableStock: stock }]);
      mockCartStoreId = storeId;
      if (line) {
        line.product = { ...product };
        line.quantity += quantity;
        line.lineTotal = (line.product.salePrice ?? line.product.price) * line.quantity;
      } else {
        mockCart.push({ itemId: `mock-cart-${productId}`, product: { ...product }, quantity, lineTotal: (product.salePrice ?? product.price) * quantity, priceAtAdd: product.salePrice ?? product.price });
      }
      persistMockCart();
      return { productId, quantity };
    }
    return http.post<{ success: true; data: unknown }>('/cart/items', { productId, quantity, storeId }).then(unwrapApiResponse);
  },
  update: async (itemId: string, quantity: number) => {
    if (isMockEnabled) {
      const line = mockCart.find((item) => item.itemId === itemId);
      if (!line) throw new MockApiError('Không tìm thấy sản phẩm trong giỏ.', 'CART_ITEM_NOT_FOUND');
      const currentProduct = mockProducts.find((item) => item.productId === line.product.productId);
      if (currentProduct) {
        const currentPrice = currentProduct.salePrice ?? currentProduct.price;
        if (line.priceAtAdd !== undefined && line.priceAtAdd !== currentPrice) line.priceAtAdd = currentPrice;
        line.product = { ...currentProduct };
      }
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

export const validateMockCartForOrder = validateMockCart;
