export interface Voucher {
  voucherId: string;
  code: string;
  discountValue: number;
  discountType?: 'PERCENT' | 'FIXED';
  minimumOrder: number;
  startDate: string;
  endDate: string;
}