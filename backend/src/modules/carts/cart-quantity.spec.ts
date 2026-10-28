import { ConflictException } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-codes';
import { clampCartQuantity, validateCartQuantity } from './carts.service';

describe('quy tắc số lượng giỏ hàng', () => {
  it('chấp nhận số lượng kg theo bước 0,5 và từ chối phần lẻ không hợp lệ', () => {
    expect(() => validateCartQuantity('kg', 1.5)).not.toThrow();
    expect(() => validateCartQuantity('kg', 1.25)).toThrow(ConflictException);
  });

  it('chỉ nhận số nguyên cho sản phẩm không cân', () => {
    expect(() => validateCartQuantity('chai', 2)).not.toThrow();
    expect(() => validateCartQuantity('chai', 1.5)).toThrow(ConflictException);
  });

  it('tự giảm số lượng về tồn khả dụng theo bước hợp lệ', () => {
    expect(clampCartQuantity('kg', 2, 1.8)).toBe(1.5);
    expect(clampCartQuantity('chai', 5, 3.8)).toBe(3);
    try {
      validateCartQuantity('kg', 0.25);
      throw new Error('Dự kiến lỗi INVALID_QUANTITY');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code: ErrorCode.INVALID_QUANTITY });
    }
  });
});
