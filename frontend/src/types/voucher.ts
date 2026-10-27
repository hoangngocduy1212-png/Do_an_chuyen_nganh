export interface Voucher {
  voucherId: string;
  code: string;
  discountValue: number;
  minimumOrder: number;
  startDate: string;
  endDate: string;
}