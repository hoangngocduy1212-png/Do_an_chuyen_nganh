import type { StoreLocation } from '../types/store';
import { mockStores } from './mock/data';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import { mockScenario } from './mock/scenarios';

export interface StoreManagementRecord {
  _id: string;
  storeName: string;
  address: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StoreManagementInput {
  storeName: string;
  address: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface StoreApiRecord {
  _id?: string;
  storeId?: string;
  storeName?: string;
  name?: string;
  address?: string;
  phone?: string;
  phoneNumber?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

function toManagementRecord(store: StoreApiRecord): StoreManagementRecord {
  return {
    _id: store._id ?? store.storeId ?? '',
    storeName: store.storeName ?? store.name ?? '',
    address: store.address ?? '',
    phone: store.phone ?? store.phoneNumber ?? '',
    status: store.status ?? 'ACTIVE',
  };
}

export const storesApi = {
  list: async () => {
    const stores = isMockEnabled
      ? mockStores
      : await http.get<{ success: true; data: StoreLocation[] }>('/stores').then(unwrapApiResponse);
    return stores.filter((store) => store.status === 'ACTIVE');
  },
  adminList: async (): Promise<StoreManagementRecord[]> => {
    if (isMockEnabled) return mockStores.map((store) => toManagementRecord(store));
    const records = await http.get<{ success: true; data: StoreApiRecord[] }>('/stores').then(unwrapApiResponse);
    return records.map(toManagementRecord);
  },
  adminCreate: async (body: StoreManagementInput): Promise<StoreManagementRecord> => {
    if (isMockEnabled) {
      const store: StoreLocation = { _id: `mock-store-${Date.now()}`, name: body.storeName, address: body.address, phoneNumber: body.phone, status: body.status };
      mockStores.push(store);
      return toManagementRecord(store);
    }
    const record = await http.post<{ success: true; data: StoreApiRecord }>('/stores', body).then(unwrapApiResponse);
    return toManagementRecord(record);
  },
  adminUpdate: async (id: string, body: Partial<StoreManagementInput>): Promise<StoreManagementRecord> => {
    if (isMockEnabled) {
      const store = mockStores.find((item) => item._id === id);
      if (!store) throw new Error('Không tìm thấy cửa hàng');
      if (body.storeName !== undefined) store.name = body.storeName;
      if (body.address !== undefined) store.address = body.address;
      if (body.phone !== undefined) store.phoneNumber = body.phone;
      if (body.status !== undefined) store.status = body.status;
      return toManagementRecord(store);
    }
    const record = await http.patch<{ success: true; data: StoreApiRecord }>(`/stores/${id}`, body).then(unwrapApiResponse);
    return toManagementRecord(record);
  },
  checkDelivery: async (storeId: string, address: string): Promise<{ serviceable: boolean; estimatedFee: number }> => {
    if (isMockEnabled) {
      const lower = address.toLocaleLowerCase('vi');
      const serviceable = mockScenario.deliveryAddressMode === 'outside'
        ? false
        : mockScenario.deliveryAddressMode === 'inside'
          ? true
          : !lower.includes('long an') && !lower.includes('bình dương') && !lower.includes('ngoài vùng');
      return { serviceable, estimatedFee: serviceable ? 20000 : 0 };
    }
    try { return await http.post<{ success: true; data: { serviceable: boolean; estimatedFee: number } }>(`/stores/${storeId}/serviceability`, { address }).then(unwrapApiResponse); }
    catch { return { serviceable: true, estimatedFee: 20000 }; }
  },
};