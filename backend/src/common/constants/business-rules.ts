import { ConfigService } from '@nestjs/config';

export const FREE_SHIP_THRESHOLD = 200000;
export const DEFAULT_SHIPPING_FEE = 20000;
export const PAYMENT_RESERVATION_DURATION_MS = 15 * 60 * 1000;
export const POINTS_PER_SPEND = 10000;
export const MAX_WEIGHT_MULTIPLIER = 1.2;
export const RETURN_WINDOW_DAYS = 7;

export type ReceiveMethod = 'DELIVERY' | 'PICKUP';

export function getBusinessRules(config: ConfigService): {
  freeShipThreshold: number;
  defaultShippingFee: number;
  paymentReservationDurationMs: number;
  pointsPerSpend: number;
  maxWeightMultiplier: number;
  returnWindowDays: number;
} {
  return {
    freeShipThreshold: config.get<number>('business.freeShipThreshold') ?? FREE_SHIP_THRESHOLD,
    defaultShippingFee: config.get<number>('business.defaultShippingFee') ?? DEFAULT_SHIPPING_FEE,
    paymentReservationDurationMs: PAYMENT_RESERVATION_DURATION_MS,
    pointsPerSpend: POINTS_PER_SPEND,
    maxWeightMultiplier: MAX_WEIGHT_MULTIPLIER,
    returnWindowDays: RETURN_WINDOW_DAYS,
  };
}

export function calculateShippingFee(
  receiveMethod: ReceiveMethod,
  subtotalBeforeVoucher: number,
  baseFee: number,
  freeShipThreshold = FREE_SHIP_THRESHOLD,
): number {
  if (receiveMethod === 'PICKUP' || subtotalBeforeVoucher >= freeShipThreshold) return 0;
  return baseFee;
}

export function calculateEarnedPoints(totalAmount: number, shippingFee: number): number {
  return Math.floor(Math.max(0, totalAmount - shippingFee) / POINTS_PER_SPEND);
}
