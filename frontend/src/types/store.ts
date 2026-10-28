export type ReceiveMethod = 'DELIVERY' | 'PICKUP';
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface StoreOpeningHoursDay {
  open: string;
  close: string;
  closed: boolean;
}

export type StoreOpeningHours = string | Partial<Record<Weekday, StoreOpeningHoursDay>>;
export interface StoreLocation {
  _id: string;
  name: string;
  address: string;
  phoneNumber?: string;
  openingHours?: StoreOpeningHours;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StoreSelection {
  storeId: string;
  receiveMethod: ReceiveMethod;
  deliveryAddress: string;
}