import {
  calculateEarnedPoints,
  calculateShippingFee,
  DEFAULT_SHIPPING_FEE,
  FREE_SHIP_THRESHOLD,
} from './business-rules';

describe('quy tắc kinh doanh mặc định', () => {
  it('miễn phí giao hàng từ 200.000đ và phí giao mặc định là 20.000đ', () => {
    expect(FREE_SHIP_THRESHOLD).toBe(200000);
    expect(DEFAULT_SHIPPING_FEE).toBe(20000);
  });

  it('áp dụng đúng ngưỡng miễn phí giao hàng trước voucher', () => {
    expect(calculateShippingFee('DELIVERY', 199999, DEFAULT_SHIPPING_FEE)).toBe(20000);
    expect(calculateShippingFee('DELIVERY', 200000, DEFAULT_SHIPPING_FEE)).toBe(0);
    expect(calculateShippingFee('PICKUP', 100000, DEFAULT_SHIPPING_FEE)).toBe(0);
  });

  it('tính điểm theo 10.000đ sau khi trừ phí giao hàng, làm tròn xuống', () => {
    expect(calculateEarnedPoints(219999, 20000)).toBe(19);
    expect(calculateEarnedPoints(20000, 20000)).toBe(0);
  });
});
