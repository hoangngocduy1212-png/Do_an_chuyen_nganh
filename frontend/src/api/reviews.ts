import type { CustomerReview } from '../types/review';
import { mockReviews } from './mock/account';
import { http, isMockEnabled, unwrapApiResponse } from './client';

export const reviewsApi = {
  product: async (productId: string, page = 1): Promise<{ items: Array<{ reviewId: string; userName: string; rating: number; comment: string; createdAt: string }>; total: number }> => {
    if (isMockEnabled) {
      const items = [
        { reviewId: `${productId}-r1`, userName: 'Nguyễn Thị Minh Anh', rating: 5, comment: 'Sản phẩm tươi ngon, đóng gói cẩn thận. Sẽ tiếp tục ủng hộ.', createdAt: '2026-10-24T08:30:00+07:00' },
        { reviewId: `${productId}-r2`, userName: 'Trần Văn Bình', rating: 4, comment: 'Chất lượng tốt, giao hàng nhanh.', createdAt: '2026-10-20T14:10:00+07:00' },
      ];
      return { items: page === 1 ? items : [], total: items.length };
    }
    return http.get<{ success: true; data: { items: Array<{ reviewId: string; userName: string; rating: number; comment: string; createdAt: string }>; total: number } }>(`/products/${productId}/reviews`, { params: { page, limit: 5 } }).then(unwrapApiResponse);
  },
  mine: async (status: 'pending' | 'done'): Promise<CustomerReview[]> => isMockEnabled
    ? import.meta.env.VITE_MOCK_REVIEWS_ERROR === 'true' ? Promise.reject(new Error('Không tải được đánh giá')) : import.meta.env.VITE_MOCK_REVIEWS_EMPTY === 'true' || import.meta.env.VITE_MOCK_REVIEWS_EMPTY === status ? [] : mockReviews.filter((review) => status === 'pending' ? review.status === 'PENDING' : review.status === 'REVIEWED').map((review) => ({ ...review, ...(import.meta.env.VITE_MOCK_REVIEW_IMAGE_ERROR === 'true' ? { productImage: '/mock/anh-san-pham-khong-ton-tai.jpg' } : {}) }))
    : http.get<{ success: true; data: CustomerReview[] }>('/reviews/my', { params: { status } }).then(unwrapApiResponse),
  create: async (input: Pick<CustomerReview, 'orderId' | 'productId' | 'rating' | 'comment'>): Promise<CustomerReview> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_REVIEW_DUPLICATE === 'true') {
        const conflict = new Error('Bạn đã đánh giá sản phẩm này');
        Object.assign(conflict, { status: 409 });
        throw conflict;
      }
      const existing = mockReviews.find((item) => item.productId === input.productId && item.orderId === input.orderId);
      if (existing?.status === 'REVIEWED') {
        const conflict = new Error('Bạn đã đánh giá sản phẩm này');
        Object.assign(conflict, { status: 409 });
        throw conflict;
      }
      const review: CustomerReview = { ...input, reviewId: existing?.reviewId ?? crypto.randomUUID(), productId: input.productId, productName: existing?.productName ?? 'Sản phẩm', productImage: existing?.productImage, status: 'REVIEWED', createdAt: new Date().toISOString() };
      const existingIndex = mockReviews.findIndex((item) => item.productId === input.productId && item.orderId === input.orderId);
      if (existingIndex >= 0) mockReviews[existingIndex] = review;
      else mockReviews.push(review);
      return review;
    }
    try { return await http.post<{ success: true; data: CustomerReview }>('/reviews', input).then(unwrapApiResponse); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error && (error as { response?: { status?: number } }).response?.status === 409) {
        throw new Error('Bạn đã đánh giá sản phẩm này');
      }
      throw error;
    }
  },
};