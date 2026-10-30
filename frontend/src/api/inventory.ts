import { http, isMockEnabled, unwrapApiResponse } from './client';
import { mockProducts, mockStockByStore } from './mock/data';

export interface InventoryRecord {
  inventoryId?: string;
  _id?: string;
  storeId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

export interface InventoryChangeInput {
  storeId: string;
  productId: string;
  quantity: number;
}

const mockInventory: InventoryRecord[] = Object.entries(mockStockByStore).flatMap(([storeId, productStocks]) =>
  Object.entries(productStocks).map(([productId, quantity]) => ({
    inventoryId: `${storeId}-${productId}`,
    storeId,
    productId,
    quantity,
    reservedQuantity: 0,
    lowStockThreshold: 10,
  })),
);

export const inventoryApi = {
  list: async (storeId?: string): Promise<InventoryRecord[]> => {
    if (isMockEnabled) return mockInventory.filter((item) => !storeId || item.storeId === storeId).map((item) => ({ ...item }));
    const response = await http.get<{ success: true; data: InventoryRecord[] }>('/inventory', { params: storeId ? { storeId } : undefined });
    return unwrapApiResponse(response);
  },
  importStock: async (input: InventoryChangeInput): Promise<InventoryRecord> => {
    if (isMockEnabled) {
      let record = mockInventory.find((item) => item.storeId === input.storeId && item.productId === input.productId);
      if (!record) {
        record = { inventoryId: `${input.storeId}-${input.productId}`, ...input, reservedQuantity: 0, lowStockThreshold: 10 };
        mockInventory.push(record);
      } else {
        record.quantity += input.quantity;
      }
      return { ...record };
    }
    const response = await http.post<{ success: true; data: InventoryRecord }>('/inventory/import', input);
    return unwrapApiResponse(response);
  },
  exportStock: async (input: InventoryChangeInput): Promise<InventoryRecord> => {
    if (isMockEnabled) {
      const record = mockInventory.find((item) => item.storeId === input.storeId && item.productId === input.productId);
      const available = record ? Math.max(0, record.quantity - record.reservedQuantity) : 0;
      if (!record || input.quantity > available) throw new Error('Số lượng xuất vượt quá tồn kho khả dụng');
      record.quantity -= input.quantity;
      return { ...record };
    }
    const response = await http.post<{ success: true; data: InventoryRecord }>('/inventory/export', input);
    return unwrapApiResponse(response);
  },
};

export function inventoryProductLabel(productId: string): string {
  return mockProducts.find((product) => product.productId === productId)?.productName ?? productId;
}
