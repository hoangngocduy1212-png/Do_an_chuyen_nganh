export interface CustomerReview {
  reviewId: string;
  orderId: string;
  productId: string;
  productName: string;
  productImage?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
  deliveredAt?: string;
  status: 'PENDING' | 'REVIEWED';
}