export interface Product {
  productId: string;
  productName: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  price: number;
  originalPrice?: number;
  unit: string;
  image: string;
  status: 'ACTIVE' | 'INACTIVE';
  avgRating: number;
  reviewCount: number;
  stock: number;
  badge?: string;
  soldCount?: number;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
}
