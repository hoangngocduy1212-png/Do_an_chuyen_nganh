import type { Product } from '../types/product';
import { mockCategories, mockProducts, mockStockByStore } from './mock/data';
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

export interface AdminProductRecord {
  productId: string;
  productName: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  originalPrice?: number;
  unit: string;
  image: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface AdminProductInput {
  productName: string;
  description: string;
  categoryId: string;
  price: number;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE';
  image?: File;
}

export interface AdminProductPage {
  items: AdminProductRecord[];
  total: number;
  page: number;
  limit: number;
}

interface ProductApiRecord extends Partial<AdminProductRecord> {
  _id?: string;
  name?: string;
  imageUrl?: string;
}

function toAdminProduct(product: ProductApiRecord): AdminProductRecord {
  return {
    productId: product.productId ?? product._id ?? '',
    productName: product.productName ?? product.name ?? '',
    description: product.description ?? '',
    categoryId: product.categoryId ?? '',
    categoryName: product.categoryName ?? '',
    price: product.price ?? 0,
    ...(product.originalPrice === undefined ? {} : { originalPrice: product.originalPrice }),
    unit: product.unit ?? '',
    image: product.image ?? product.imageUrl ?? '',
    status: product.status ?? 'ACTIVE',
  };
}

function productFormData(input: AdminProductInput): FormData {
  const formData = new FormData();
  formData.append('productName', input.productName);
  formData.append('description', input.description);
  formData.append('categoryId', input.categoryId);
  formData.append('price', String(input.price));
  formData.append('unit', input.unit);
  formData.append('status', input.status);
  if (input.image) formData.append('image', input.image);
  return formData;
}

function mockProductsForStore(storeId: string) {
  return mockProducts.map((product) => ({
    ...product,
    stock: mockStockByStore[storeId]?.[product.productId] ?? product.stock,
  }));
}

export const productsApi = {
  get: async (productId: string, storeId: string): Promise<Product | null> => {
    if (isMockEnabled) return mockProductsForStore(storeId).find((product) => product.productId === productId) ?? null;
    try {
      return await http.get<{ success: true; data: Product }>(`/products/${productId}`, { params: { storeId } }).then(unwrapApiResponse);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error && (error as { response?: { status?: number } }).response?.status === 404) return null;
      throw error;
    }
  },
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
  adminListPage: async (params: { q?: string; categoryId?: string; page?: number; limit?: number }): Promise<AdminProductPage> => {
    const query = { page: 1, limit: 20, ...params };
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_PRODUCTS_MODE === 'error') throw new Error('Không tải được sản phẩm mock');
      if (import.meta.env.VITE_MOCK_PRODUCTS_MODE === 'empty') return { items: [], total: 0, page: query.page, limit: query.limit };
      const matching = mockProducts.filter((product) => {
        const text = `${product.productName} ${product.categoryName}`.toLocaleLowerCase('vi');
        return (!query.q || text.includes(query.q.toLocaleLowerCase('vi')))
          && (!query.categoryId || product.categoryId === query.categoryId);
      });
      const start = (query.page - 1) * query.limit;
      return { items: matching.slice(start, start + query.limit).map((product) => toAdminProduct(product)), total: matching.length, page: query.page, limit: query.limit };
    }
    const response = await http.get<{ success: true; data: ProductApiRecord[]; meta?: { page: number; limit: number; total: number } }>('/products', { params: query });
    const data = unwrapApiResponse(response);
    return { items: data.map(toAdminProduct), total: response.data.meta?.total ?? data.length, page: response.data.meta?.page ?? query.page, limit: response.data.meta?.limit ?? query.limit };
  },
  adminGet: async (productId: string): Promise<AdminProductRecord> => {
    if (isMockEnabled) {
      const product = mockProducts.find((item) => item.productId === productId);
      if (!product) throw new Error('Không tìm thấy sản phẩm');
      return toAdminProduct(product);
    }
    const response = await http.get<{ success: true; data: ProductApiRecord }>(`/products/${productId}`);
    return toAdminProduct(unwrapApiResponse(response));
  },
  adminCreate: async (input: AdminProductInput): Promise<AdminProductRecord> => {
    if (isMockEnabled) {
      const category = mockCategories.find((item) => item._id === input.categoryId);
      const product: Product = {
        productId: `mock-product-${Date.now()}`,
        productName: input.productName,
        description: input.description,
        categoryId: input.categoryId,
        categoryName: category?.categoryName ?? '',
        price: input.price,
        unit: input.unit,
        image: input.image ? URL.createObjectURL(input.image) : '',
        status: input.status,
        avgRating: 0,
        reviewCount: 0,
        stock: 0,
      };
      mockProducts.unshift(product);
      return toAdminProduct(product);
    }
    const response = await http.post<{ success: true; data: ProductApiRecord }>('/products', productFormData(input));
    return toAdminProduct(unwrapApiResponse(response));
  },
  adminUpdate: async (productId: string, input: AdminProductInput): Promise<AdminProductRecord> => {
    if (isMockEnabled) {
      const product = mockProducts.find((item) => item.productId === productId);
      if (!product) throw new Error('Không tìm thấy sản phẩm');
      const category = mockCategories.find((item) => item._id === input.categoryId);
      Object.assign(product, {
        productName: input.productName,
        description: input.description,
        categoryId: input.categoryId,
        categoryName: category?.categoryName ?? '',
        price: input.price,
        unit: input.unit,
        status: input.status,
        ...(input.image ? { image: URL.createObjectURL(input.image) } : {}),
      });
      return toAdminProduct(product);
    }
    const response = await http.patch<{ success: true; data: ProductApiRecord }>(`/products/${productId}`, productFormData(input));
    return toAdminProduct(unwrapApiResponse(response));
  },
  list: async (params: ProductListParams) => (await productsApi.listPage(params)).items,
};