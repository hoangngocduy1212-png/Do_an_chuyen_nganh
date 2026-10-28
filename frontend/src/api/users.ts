import type { UserProfile } from '../types/user';
import { http, isMockEnabled, unwrapApiResponse } from './client';
import { mockUserProfile } from './mock/account';

export interface CustomerAddress {
  addressId: string;
  label: 'Nhà' | 'Công ty' | 'Khác';
  recipientName: string;
  phoneNumber: string;
  addressLine: string;
  isDefault: boolean;
}

export class UserActionError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) { super(message); this.name = 'UserActionError'; }
}

let profile: UserProfile = { ...mockUserProfile, ...(import.meta.env.VITE_MOCK_USER_AVATAR === 'true' ? { avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80' } : {}) };
const configuredAddressCount = Number(import.meta.env.VITE_MOCK_ADDRESS_COUNT ?? 2);
const addressCount = Number.isFinite(configuredAddressCount) ? Math.min(5, Math.max(0, Math.floor(configuredAddressCount))) : 2;
let addresses: CustomerAddress[] = Array.from({ length: addressCount }, (_, index) => ({
  addressId: `addr-0${index + 1}`,
  label: (['Nhà', 'Công ty', 'Khác', 'Nhà', 'Khác'] as const)[index],
  recipientName: 'Nguyễn Minh Anh',
  phoneNumber: '0901234567',
  addressLine: index === 0 ? mockUserProfile.defaultAddress ?? '' : index === 1 ? '45 Võ Văn Tần, Phường 6, Quận 3, TP. Hồ Chí Minh' : `${index + 10} Nguyễn Văn Cừ, Phường 2, Quận 5, TP. Hồ Chí Minh`,
  isDefault: index === 0,
}));

export const usersApi = {
  me: async (): Promise<UserProfile> => isMockEnabled
    ? import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'profile' ? Promise.reject(new Error('Không tải được hồ sơ')) : { ...profile }
    : http.get<{ success: true; data: UserProfile }>('/users/me').then(unwrapApiResponse),
  updateMe: async (updates: Partial<Pick<UserProfile, 'fullName' | 'phoneNumber' | 'avatarUrl'>>): Promise<UserProfile> => {
    if (isMockEnabled) {
      profile = { ...profile, ...updates };
      return { ...profile };
    }
    return http.patch<{ success: true; data: UserProfile }>('/users/me', updates).then(unwrapApiResponse);
  },
  addresses: async (): Promise<CustomerAddress[]> => isMockEnabled
    ? import.meta.env.VITE_MOCK_ACCOUNT_NETWORK_ERROR === 'addresses' ? Promise.reject(new Error('Không tải được địa chỉ')) : addresses.map((address) => ({ ...address }))
    : http.get<{ success: true; data: CustomerAddress[] }>('/users/me/addresses').then(unwrapApiResponse),
  createAddress: async (input: Omit<CustomerAddress, 'addressId'>): Promise<CustomerAddress> => {
    if (isMockEnabled) {
      if (addresses.length >= 5) throw new Error('Bạn chỉ có thể lưu tối đa 5 địa chỉ');
      const address = { ...input, addressId: crypto.randomUUID() };
      addresses = input.isDefault ? addresses.map((item) => ({ ...item, isDefault: false })) : addresses;
      addresses = [...addresses, address];
      return address;
    }
    return http.post<{ success: true; data: CustomerAddress }>('/users/me/addresses', input).then(unwrapApiResponse);
  },
  updateAddress: async (addressId: string, input: Omit<CustomerAddress, 'addressId'>): Promise<CustomerAddress> => {
    if (isMockEnabled) {
      addresses = addresses.map((item) => ({ ...item, isDefault: input.isDefault ? false : item.isDefault }));
      const updated = { ...input, addressId };
      addresses = addresses.map((item) => item.addressId === addressId ? updated : item);
      return updated;
    }
    return http.patch<{ success: true; data: CustomerAddress }>(`/users/me/addresses/${addressId}`, input).then(unwrapApiResponse);
  },
  deleteAddress: async (addressId: string): Promise<void> => {
    if (isMockEnabled) { addresses = addresses.filter((item) => item.addressId !== addressId); return; }
    await http.delete(`/users/me/addresses/${addressId}`);
  },
  setDefaultAddress: async (addressId: string): Promise<void> => {
    if (isMockEnabled) {
      addresses = addresses.map((item) => ({ ...item, isDefault: item.addressId === addressId }));
      profile.defaultAddress = addresses.find((item) => item.isDefault)?.addressLine;
      return;
    }
    await http.patch(`/users/me/addresses/${addressId}/default`);
  },
  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_PASSWORD_ERROR === 'true' || currentPassword !== 'Muadee123') throw new UserActionError('Mật khẩu hiện tại không đúng', 'INVALID_CURRENT_PASSWORD', 400);
      return;
    }
    try { await http.patch('/users/me/password', { currentPassword, newPassword }); }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } }).response;
        throw new UserActionError(response?.data?.error?.message ?? 'Không thể đổi mật khẩu.', response?.data?.error?.code, response?.status);
      }
      throw error;
    }
  },
  deleteMe: async (password: string): Promise<void> => {
    if (isMockEnabled) {
      if (import.meta.env.VITE_MOCK_DELETE_ERROR === 'true' || password !== 'Muadee123') throw new UserActionError('Mật khẩu không đúng', 'INVALID_CURRENT_PASSWORD', 400);
      return;
    }
    await http.delete('/users/me', { data: { password } });
  },
};