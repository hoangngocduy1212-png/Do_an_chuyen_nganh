import type { Product } from './product';

export interface CartItem {
  itemId: string;
  product: Product;
  quantity: number;
  lineTotal: number;
  stock?: number;
  priceAtAdd?: number;
}

export interface CartSummary {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
}