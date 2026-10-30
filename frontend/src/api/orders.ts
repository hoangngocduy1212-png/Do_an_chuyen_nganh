import type { CustomerOrder, OrderStatus, OrderTrackingEvent } from '../types/order';
import { mockOrders, mockTrackingEvents } from './mock/account';
import { mockProducts, mockStockByStore, mockStores } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse, errorMessage } from './client';
import { cartApi, validateMockCartForOrder, type CartValidationChange } from './cart';
import { MockApiError, mockScenario } from './mock/scenarios';
import { storesApi } from './stores';
import { vouchersApi } from './vouchers';

const MOCK_ORDERS_KEY = 'muadee-mock-orders';
const MOCK_SEED_ORDER_STATES_KEY = 'muadee-mock-order-states';
const MOCK_IDEMPOTENCY_KEY = 'muadee-mock-idempotency';

export interface AdminOrderRecord extends CustomerOrder {
  _id?: string;
  customerId?: string;
  paidAmount?: number;
  amountDue?: number;
  statusHistory?: Array<{ status: OrderStatus; at: string; by: string }>;
  payments?: Array<{ paymentId: string; paymentMethod: string; paymentStatus: string; amount: number; createdAt?: string }>;
}

export interface AdminOrderPage {
  items: AdminOrderRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderPreviewInput {
  storeId: string;
  receiveMethod: 'DELIVERY' | 'PICKUP';
  shippingAddress?: string;
  voucherCode?: string;
}

export interface OrderPreview {
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  estimatedPoints: number;
  hasWeightedItems: boolean;
}

interface OutOfStockProduct {
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableStock: number;
}

type MockSeedOrderState = Pick<CustomerOrder, 'orderId' | 'orderStatus'> & Partial<Pick<CustomerOrder, 'note' | 'recipientName' | 'recipientPhone' | 'shippingAddress' | 'pickupTime' | 'pickupNote'>>;

type StoredMockCartLine = {
  itemId: string;
  product: { productId: string; productName: string; image: string; unit: string; price: number; stock?: number; salePrice?: number };
  quantity: number;
};

function readMockOrders(): CustomerOrder[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MOCK_ORDERS_KEY) ?? '[]');
    return Array.isArray(stored) ? stored as CustomerOrder[] : [];
  } catch { return []; }
}

function readIdempotencyMap(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MOCK_IDEMPOTENCY_KEY) ?? '{}');
    return stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, string> : {};
  } catch { return {}; }
}

function readSeedOrderStates(): MockSeedOrderState[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MOCK_SEED_ORDER_STATES_KEY) ?? '[]');
    return Array.isArray(stored) ? stored as MockSeedOrderState[] : [];
  } catch { return []; }
}

const mockPlacedOrders = readMockOrders();
const mockIdempotencyMap = readIdempotencyMap();
const storedSeedStates = readSeedOrderStates();
const mockSeedOrders = mockOrders.map((order) => {
  const state = storedSeedStates.find((item) => item.orderId === order.orderId);
  return state ? { ...order, ...state } : { ...order };
});
function allMockOrders() { return [...mockPlacedOrders, ...mockSeedOrders]; }
function persistMockOrders() {
  localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(mockPlacedOrders));
  localStorage.setItem(MOCK_SEED_ORDER_STATES_KEY, JSON.stringify(mockSeedOrders.map(({ orderId, orderStatus, note, recipientName, recipientPhone, shippingAddress, pickupTime, pickupNote }) => ({ orderId, orderStatus, note, recipientName, recipientPhone, shippingAddress, pickupTime, pickupNote }))));
}
function persistIdempotency() { localStorage.setItem(MOCK_IDEMPOTENCY_KEY, JSON.stringify(mockIdempotencyMap)); }
function findMockOrder(orderId: string) { return allMockOrders().find((item) => item.orderId === orderId || item.orderCode === orderId); }

function readStoredCart(): StoredMockCartLine[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('muadee-mock-cart') ?? '[]');
    return Array.isArray(stored) ? stored as StoredMockCartLine[] : [];
  } catch { return []; }
}

function assertActiveStore(storeId: string) {
  if (!mockStores.some((store) => store._id === storeId && store.status === 'ACTIVE')) {
    throw new MockApiError('Cửa hàng hiện không hoạt động, vui lòng chọn cửa hàng khác.', 'STORE_UNAVAILABLE');
  }
}

function outOfStockItems(storeId: string, lines: StoredMockCartLine[]): OutOfStockProduct[] {
  return lines.flatMap((line) => {
    const product = mockProducts.find((item) => item.productId === line.product.productId) ?? line.product;
    const availableStock = mockStockByStore[storeId]?.[product.productId] ?? product.stock;
    return availableStock < line.quantity ? [{ productId: product.productId, productName: product.productName, requestedQuantity: line.quantity, availableStock }] : [];
  });
}

function assertValidCart(storeId: string, lines: StoredMockCartLine[]) {
  const validation = validateMockCartForOrder(storeId);
  const stockChanges = validation.changes.filter((change) => change.type !== 'PRICE');
  if (stockChanges.length) {
    const insufficient = stockChanges.map((change: CartValidationChange) => ({
      productId: change.productId,
      productName: change.productName,
      requestedQuantity: lines.find((line) => line.product.productId === change.productId)?.quantity ?? 0,
      availableStock: change.availableStock,
    }));
    throw new MockApiError('Một số sản phẩm không đủ hàng tại cửa hàng đã chọn.', 'OUT_OF_STOCK', insufficient);
  }
}

export const ordersApi = {
  adminList: async (params: { orderStatus?: OrderStatus; storeId?: string; page: number; limit: number }): Promise<AdminOrderPage> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_ORDERS_EMPTY === 'true') return { items: [], total: 0, page: params.page, limit: params.limit };
      if (import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'orders') throw new MockApiError('Không tải được đơn hàng.', 'NETWORK');
      const filtered = allMockOrders().filter((order) => (!params.orderStatus || order.orderStatus === params.orderStatus) && (!params.storeId || order.storeId === params.storeId));
      const start = (params.page - 1) * params.limit;
      return { items: filtered.slice(start, start + params.limit).map((order) => ({ ...order })), total: filtered.length, page: params.page, limit: params.limit };
    }
    const response = await http.get<{ success: true; data: AdminOrderRecord[]; meta?: { page: number; limit: number; total: number } }>('/orders', { params });
    const items = unwrapApiResponse(response);
    return { items, total: response.data.meta?.total ?? items.length, page: response.data.meta?.page ?? params.page, limit: response.data.meta?.limit ?? params.limit };
  },
  adminGet: async (orderId: string): Promise<AdminOrderRecord> => {
    if (isMockEnabled) {
      const order = findMockOrder(orderId);
      if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
      return { ...order, items: order.items?.map((item) => ({ ...item })) };
    }
    const response = await http.get<{ success: true; data: AdminOrderRecord }>(`/orders/${orderId}`);
    return unwrapApiResponse(response);
  },
  mine: async (limit = 20): Promise<CustomerOrder[]> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_ORDERS_EMPTY === 'true') return [];
      if (import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'orders') throw new MockApiError('Không tải được đơn hàng.', 'NETWORK');
      return allMockOrders().slice(0, limit).map((order) => ({ ...order, itemCount: order.itemCount ?? order.items?.length ?? 0, items: order.items?.slice(0, 2) }));
    }
    return http.get<{ success: true; data: CustomerOrder[] }>('/orders/my', { params: { limit } }).then(unwrapApiResponse);
  },
  get: async (orderId: string): Promise<CustomerOrder> => {
    if (isMockEnabled) {
      const order = findMockOrder(orderId);
      if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
      return { ...order, items: order.items?.map((item) => ({ ...item })) };
    }
    return http.get<{ success: true; data: CustomerOrder }>(`/orders/${orderId}`).then(unwrapApiResponse);
  },
  preview: async (input: OrderPreviewInput): Promise<OrderPreview> => {
    if (!isMockEnabled) return http.post<{ success: true; data: OrderPreview }>('/orders/preview', input).then(unwrapApiResponse);
    assertActiveStore(input.storeId);
    assertValidCart(input.storeId, readStoredCart());
    const cart = await cartApi.get(input.storeId);
    const subtotal = cart.items.reduce((sum, item) => sum + item.currentPrice * item.quantity, 0);
    const discountAmount = input.voucherCode ? (await vouchersApi.validate(input.voucherCode, subtotal)).discountAmount : 0;
    const delivery = input.receiveMethod === 'DELIVERY' && input.shippingAddress ? await storesApi.checkDelivery(input.storeId, input.shippingAddress) : { serviceable: true, estimatedFee: 0 };
    if (!delivery.serviceable) throw new MockApiError('Địa chỉ nằm ngoài khu vực giao hàng.', 'DELIVERY_UNAVAILABLE');
    const shippingFee = input.receiveMethod === 'DELIVERY' ? delivery.estimatedFee : 0;
    const totalAmount = Math.max(0, subtotal - discountAmount) + shippingFee;
    return { subtotal, discountAmount, shippingFee, totalAmount, estimatedPoints: Math.floor(totalAmount / 10_000), hasWeightedItems: cart.items.some((item) => item.product.unit === 'kg') };
  },
  create: async (input: { storeId: string; receiveMethod: 'DELIVERY' | 'PICKUP'; shippingAddress?: string; recipientName?: string; recipientPhone?: string; pickupTime?: string; pickupNote?: string; note?: string; voucherCode?: string }, idempotencyKey: string, estimatedTotal = 0): Promise<CustomerOrder> => {
    if (isMockEnabled) {
      if (idempotencyKey && mockIdempotencyMap[idempotencyKey]) {
        const existing = findMockOrder(mockIdempotencyMap[idempotencyKey]);
        if (existing) return { ...existing };
      }
      if (mockScenario.orderCreateMode === 'network-error') throw new MockApiError('Không thể kết nối, vui lòng thử lại.', 'NETWORK');
      if (mockScenario.orderCreateMode === 'store-unavailable') throw new MockApiError('Cửa hàng hiện không hoạt động, vui lòng chọn cửa hàng khác.', 'STORE_UNAVAILABLE');
      assertActiveStore(input.storeId);
      const cartLines = readStoredCart();
      const insufficient = mockScenario.orderCreateMode === 'out-of-stock' ? cartLines.map((line) => ({ productId: line.product.productId, productName: line.product.productName, requestedQuantity: line.quantity, availableStock: 0 })) : outOfStockItems(input.storeId, cartLines);
      if (insufficient.length) throw new MockApiError('Sản phẩm không đủ hàng.', 'OUT_OF_STOCK', insufficient);
      const preview = await ordersApi.preview({ storeId: input.storeId, receiveMethod: input.receiveMethod, shippingAddress: input.shippingAddress, voucherCode: input.voucherCode });
      const createdAt = new Date();
      const lines = readStoredCart();
      const orderId = `mock-order-${Date.now()}`;
      const order: CustomerOrder = {
        orderId,
        orderCode: `MD${Date.now().toString().slice(-8)}`,
        orderStatus: 'PENDING',
        subtotal: preview.subtotal,
        totalAmount: estimatedTotal > 0 ? estimatedTotal : preview.totalAmount,
        discountAmount: preview.discountAmount,
        shippingFee: preview.shippingFee,
        voucherCode: input.voucherCode,
        createdAt: createdAt.toISOString(),
        estimatedDeliveryAt: new Date(createdAt.getTime() + 2 * 60 * 60_000).toISOString(),
        ...input,
        paymentStatus: 'PENDING',
        items: lines.map(({ itemId, product, quantity }) => ({
          itemId,
          productId: product.productId,
          productName: product.productName,
          image: product.image,
          quantity,
          unit: product.unit,
          price: product.salePrice ?? product.price,
        })),
      };
      mockPlacedOrders.unshift(order);
      if (idempotencyKey) mockIdempotencyMap[idempotencyKey] = orderId;
      persistMockOrders();
      persistIdempotency();
      return order;
    }
    try { return await http.post<{ success: true; data: CustomerOrder }>('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } }).then(unwrapApiResponse); }
    catch (error) {
      const response = typeof error === 'object' && error !== null && 'response' in error ? (error as { response?: { data?: { error?: { code?: string; message?: string; details?: OutOfStockProduct[] } } } }).response : undefined;
      const code = response?.data?.error?.code;
      const normalized = new Error(response?.data?.error?.message ?? (code ? errorMessage(error) : 'Không thể kết nối, vui lòng thử lại'));
      Object.assign(normalized, { code: code ?? 'NETWORK', details: response?.data?.error?.details });
      throw normalized;
    }
  },
  cancel: async (orderId: string, reason: string) => {
    if (isMockEnabled) {
      const order = findMockOrder(orderId);
      if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
      if (order.orderStatus !== 'PENDING') throw new MockApiError('Chỉ có thể hủy đơn hàng đang chờ xử lý.', 'ORDER_NOT_CANCELLABLE');
      order.orderStatus = 'CANCELLED';
      order.note = [order.note, `Lý do hủy: ${reason}`].filter(Boolean).join(' · ');
      persistMockOrders();
      return;
    }
    return http.post(`/orders/${orderId}/cancel`, { reason }).then((response) => response.data);
  },
  return: async (orderId: string, reason: string, description: string) => {
    if (isMockEnabled) {
      const order = findMockOrder(orderId);
      if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
      if (order.orderStatus !== 'DELIVERED') throw new MockApiError('Chỉ có thể trả hàng đã giao thành công.', 'ORDER_NOT_RETURNABLE');
      order.orderStatus = 'RETURNING';
      order.note = [order.note, `Yêu cầu trả hàng: ${reason} — ${description}`].filter(Boolean).join(' · ');
      persistMockOrders();
      return;
    }
    return http.post(`/orders/${orderId}/return`, { reason, description }).then((response) => response.data);
  },
  updateShippingInfo: async (orderId: string, input: { recipientName?: string; recipientPhone?: string; shippingAddress?: string; pickupTime?: string; pickupNote?: string }) => {
    if (isMockEnabled) {
      const order = findMockOrder(orderId);
      if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
      if (order.orderStatus !== 'PENDING') throw new MockApiError('Không thể sửa thông tin khi đơn không còn chờ xử lý.', 'ORDER_NOT_EDITABLE');
      Object.assign(order, input);
      persistMockOrders();
      return;
    }
    return http.patch(`/orders/${orderId}/shipping-info`, input).then((response) => response.data);
  },
  tracking: async (orderId: string) => {
    if (!isMockEnabled) return http.get<{ success: true; data: { events: OrderTrackingEvent[]; carrierName?: string; trackingCode?: string; status?: string } }>(`/orders/${orderId}/tracking`).then(unwrapApiResponse);
    if (mockScenario.trackingMode === 'network-error') throw new MockApiError('Không thể tải hành trình giao hàng.', 'NETWORK');
    const order = findMockOrder(orderId);
    if (!order) throw new MockApiError('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND');
    const failed = mockScenario.trackingMode === 'failed';
    const events = failed
      ? [...mockTrackingEvents, { time: new Date().toISOString(), status: 'FAILED', location: 'Không liên hệ được người nhận' }]
      : order.orderStatus === 'SHIPPING' || order.orderStatus === 'DELIVERED' ? mockTrackingEvents : [];
    return {
      events,
      carrierName: order.carrierName ?? 'Muadee Express',
      trackingCode: order.trackingCode ?? `MDE-${order.orderCode}`,
      status: failed ? 'FAILED' : order.orderStatus === 'DELIVERED' ? 'DELIVERED' : order.orderStatus === 'SHIPPING' ? 'IN_TRANSIT' : 'WAITING_PICKUP',
    };
  },
};

export type { OutOfStockProduct };
