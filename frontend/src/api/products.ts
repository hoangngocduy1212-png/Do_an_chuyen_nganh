import type { Product } from '../types/product';
import { mockProducts, mockStockByStore } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export interface ProductListParams {
  storeId: string;
  q?: string;
  categoryId?: string;
  collection?: 'bestseller' | 'deals';
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

function mockProductsForStore(storeId: string) {
  return mockProducts.map((product) => ({
    ...product,
    stock: mockStockByStore[storeId]?.[product.productId] ?? product.stock,
  }));
}

export const productsApi = {
  listPage: async (params: ProductListParams): Promise<ProductPage> => {
    const queryParams = { page: 1, limit: 20, ...params };
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_PRODUCTS_MODE === 'error') throw new Error('mock-products-error');
      if (import.meta.env.VITE_MOCK_PRODUCTS_MODE === 'empty') return { items: [], total: 0, page: queryParams.page, limit: queryParams.limit };
      const query = params.q?.toLocaleLowerCase('vi');
      const now = Date.now();
      const products = mockProductsForStore(params.storeId).filter((product) => product.status === 'ACTIVE' &&
        (!params.categoryId || product.categoryId === params.categoryId)
        && (!query || `${product.productName} ${product.categoryName}`.toLocaleLowerCase('vi').includes(query))
        && (params.collection !== 'deals' || Boolean(product.salePrice && product.saleStartDate && product.saleEndDate && Date.parse(product.saleStartDate) <= now && Date.parse(product.saleEndDate) >= now))
        && (!params.inStock || product.stock > 0)
        && (params.minPrice === undefined || (product.salePrice ?? product.price) >= params.minPrice)
        && (params.maxPrice === undefined || (product.salePrice ?? product.price) <= params.maxPrice),
      );
      const sorters: Record<string, (a: Product, b: Product) => number> = {
        price: (a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price),
        '-price': (a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price),
        '-createdAt': (a, b) => b.productId.localeCompare(a.productId),
        '-sold': (a, b) => (b.soldCount ?? b.reviewCount) - (a.soldCount ?? a.reviewCount),
        '-discount': (a, b) => ((b.price - (b.salePrice ?? b.price)) / b.price) - ((a.price - (a.salePrice ?? a.price)) / a.price),
        'best-selling': (a, b) => (b.soldCount ?? b.reviewCount) - (a.soldCount ?? a.reviewCount),
      };
      const sorted = [...products].sort(sorters[params.sort ?? ''] ?? (() => 0));
      if (params.collection === 'bestseller') sorted.sort((a, b) => (b.soldCount ?? b.reviewCount) - (a.soldCount ?? a.reviewCount));
      const start = (queryParams.page - 1) * queryParams.limit;
      return { items: sorted.slice(start, start + queryParams.limit), total: sorted.length, page: queryParams.page, limit: queryParams.limit };
    }
    const response = await http.get<{ success: true; data: Product[]; meta?: { page: number; limit: number; total: number } }>('/products', { params: queryParams });
    const data = unwrapApiResponse(response);
    return { items: data.filter((product) => product.status === 'ACTIVE'), total: response.data.meta?.total ?? data.length, page: response.data.meta?.page ?? queryParams.page, limit: response.data.meta?.limit ?? queryParams.limit };
  },
  list: async (params: ProductListParams) => (await productsApi.listPage(params)).items,
};