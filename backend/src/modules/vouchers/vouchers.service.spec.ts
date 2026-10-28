import { BadRequestException } from '@nestjs/common';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Voucher, VoucherSchema } from './schemas/voucher.schema';
import { VouchersService } from './vouchers.service';

describe('VouchersService', () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let model: Model<Voucher>;
  let service: VouchersService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    model = connection.model<Voucher>(Voucher.name, VoucherSchema);
    service = new VouchersService(model);
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
  });

  it('validate giảm cố định không vượt subtotal và tăng usedCount có giới hạn', async () => {
    const [voucher] = await model.create([{
      code: 'GIAM20',
      description: 'Giảm 20.000đ',
      discountValue: 20000,
      discountType: 'FIXED',
      minOrderAmount: 0,
      usageLimit: 2,
      usedCount: 0,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status: 'ACTIVE',
    }]);

    expect((await service.validate('giam20', 100000)).discountAmount).toBe(20000);
    expect((await service.validate('GIAM20', 5000)).discountAmount).toBe(5000);
    await service.reserveUse(voucher.voucherId, 100000);
    await service.reserveUse(voucher.voucherId, 100000);
    await expect(service.reserveUse(voucher.voucherId, 100000)).rejects.toBeInstanceOf(BadRequestException);
    await service.releaseUse('giam20');
    expect((await model.findOne({ voucherId: voucher.voucherId }).lean().exec())?.usedCount).toBe(1);
  });

  it('trả mã lỗi riêng cho voucher không tồn tại, hết hạn và chưa đạt đơn tối thiểu', async () => {
    await expect(service.validate('KHONGCO', 100000)).rejects.toMatchObject({
      response: { code: 'VOUCHER_NOT_FOUND' },
    });
    const [expired] = await model.create([{
      code: 'HETHAN',
      description: 'Hết hạn',
      discountValue: 10000,
      discountType: 'FIXED',
      startDate: new Date(Date.now() - 2 * 86400000),
      endDate: new Date(Date.now() - 86400000),
      status: 'ACTIVE',
    }]);
    const [minimum] = await model.create([{
      code: 'DONLON',
      description: 'Đơn tối thiểu',
      discountValue: 10000,
      discountType: 'FIXED',
      minOrderAmount: 100000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status: 'ACTIVE',
    }]);

    await expect(service.validate(expired.code, 100000)).rejects.toMatchObject({
      response: { code: 'VOUCHER_EXPIRED' },
    });
    await expect(service.validate(minimum.code, 99999)).rejects.toMatchObject({
      response: { code: 'VOUCHER_MIN_ORDER' },
    });
  });

  it('available mặc định liệt kê mọi voucher còn hiệu lực và lọc theo giá trị đơn khi được cung cấp', async () => {
    await model.create({
      code: 'DONLON',
      description: 'Đơn tối thiểu',
      discountValue: 10000,
      discountType: 'FIXED',
      minOrderAmount: 100000,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      status: 'ACTIVE',
    });

    expect((await service.available()).map((voucher) => voucher.code)).toContain('DONLON');
    expect((await service.available(99999)).map((voucher) => voucher.code)).not.toContain('DONLON');
    expect((await service.available(100000)).map((voucher) => voucher.code)).toContain('DONLON');
  });
});
