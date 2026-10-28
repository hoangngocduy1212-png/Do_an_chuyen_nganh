export type ReceiveMethod = 'DELIVERY' | 'PICKUP';

export interface StoreLocation {
  _id: string;
  name: string;
  address: string;
  phoneNumber?: string;
  openingHours?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StoreSelection {
  storeId: string;
  receiveMethod: ReceiveMethod;
  deliveryAddress: string;
}