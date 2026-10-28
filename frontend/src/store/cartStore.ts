import { useSyncExternalStore } from 'react';
import type { Product } from '../types/product';
import type { CartResponse } from '../api/cart';

const STORAGE_KEY = 'muadee-cart';
export interface CartLine { product: Product; quantity: number; itemId?: string }

function readCart(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CartLine[]; } catch { return []; }
}

let cart = readCart();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function publish() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  listeners.forEach((listener) => listener());
}

export function useCart() {
  return useSyncExternalStore(subscribe, () => cart, () => []);
}

export const cartStore = {
  add: (product: Product, quantity = 1) => {
    const line = cart.find((item) => item.product.productId === product.productId);
    cart = line
      ? cart.map((item) => item.product.productId === product.productId ? { ...item, quantity: item.quantity + quantity } : item)
      : [...cart, { product, quantity }];
    publish();
  },
  getCount: () => cart.reduce((total, item) => total + item.quantity, 0),
  replace: (items: CartResponse['items']) => {
    cart = items.map(({ itemId, product, quantity }) => ({ itemId, product, quantity }));
    publish();
  },
  update: (productId: string, quantity: number) => {
    cart = cart.map((item) => item.product.productId === productId ? { ...item, quantity } : item);
    publish();
  },
  remove: (productId: string) => {
    cart = cart.filter((item) => item.product.productId !== productId);
    publish();
  },
  clear: () => { cart = []; publish(); },
};