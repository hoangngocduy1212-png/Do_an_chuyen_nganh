import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';
import { Voucher } from './schemas/voucher.schema';

export interface VoucherDiscount {
  voucher: Voucher;
  discountAmount: number;
}

@Injectable()
export class VouchersService {
  constructor(@InjectModel(Voucher.name) private readonly vouchers: Model<Voucher>) {}

  available(orderAmount?: number) {
    const now = new Date();
    return this.vouchers.find({
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: now },
      ...(orderAmount === undefined ? {} : { minOrderAmount: { $lte: orderAmount } }),
      $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    }).sort({ endDate: 1 }).exec();
  }

  findAll() {
    return this.vouchers.find().sort({ createdAt: -1 }).exec();
  }

  async validate(code: string, orderAmount: number): Promise<VoucherDiscount> {
    const normalized = code.trim().toUpperCase();
    const voucher = await this.vouchers.findOne({ code: normalized }).exec();
    if (!voucher || voucher.status !== 'ACTIVE') {
      throw new NotFoundException({ code: ErrorCode.VOUCHER_NOT_FOUND, message: 'Không tìm thấy voucher đang hoạt động' });
    }
    const now = new Date();
    if (voucher.startDate > now || voucher.endDate < now) {
      throw new BadRequestException({ code: ErrorCode.VOUCHER_EXPIRED, message: 'Voucher chưa có hiệu lực hoặc đã hết hạn' });
    }
    if (voucher.usageLimit !== undefined && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException({ code: ErrorCode.VOUCHER_USED_UP, message: 'Voucher đã được sử dụng hết' });
    }
    if (orderAmount < voucher.minOrderAmount) {
      throw new BadRequestException({ code: ErrorCode.VOUCHER_MIN_ORDER, message: 'Đơn hàng chưa đạt giá trị tối thiểu của voucher' });
    }
    return { voucher, discountAmount: Math.min(voucher.discountValue, orderAmount) };
  }

  async reserveUse(voucherId: string, orderAmount: number, session?: ClientSession): Promise<void> {
    const now = new Date();
    const result = await this.vouchers.updateOne(
      {
        voucherId,
        status: 'ACTIVE',
        startDate: { $lte: now },
        endDate: { $gte: now },
        minOrderAmount: { $lte: orderAmount },
        $or: [
          { usageLimit: { $exists: false } },
          { usageLimit: null },
          { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      session ? { session } : undefined,
    ).exec();
    if (result.modifiedCount !== 1) {
      const voucher = await this.vouchers.findOne({ voucherId }).select('code').lean().exec();
      if (!voucher) throw new NotFoundException({ code: ErrorCode.VOUCHER_NOT_FOUND, message: 'Không tìm thấy voucher' });
      await this.validate(voucher.code, orderAmount);
      throw new BadRequestException({ code: ErrorCode.VOUCHER_USED_UP, message: 'Voucher vừa được sử dụng hết' });
    }
  }

  async releaseUse(code: string, session?: ClientSession): Promise<void> {
    const result = await this.vouchers.updateOne(
      { code: code.trim().toUpperCase(), usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      session ? { session } : undefined,
    ).exec();
    if (result.modifiedCount !== 1) {
      throw new NotFoundException({ code: ErrorCode.VOUCHER_NOT_FOUND, message: 'Không thể hoàn lại lượt sử dụng voucher' });
    }
  }

  create(dto: CreateVoucherDto) {
    return this.vouchers.create({
      ...dto,
      code: dto.code.trim().toUpperCase(),
      discountType: 'FIXED',
    });
  }

  async update(id: string, dto: UpdateVoucherDto) {
    const update = { ...dto, ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}) };
    const voucher = await this.vouchers.findOneAndUpdate({ voucherId: id }, update, { new: true, runValidators: true }).exec();
    if (!voucher) throw new NotFoundException({ code: ErrorCode.VOUCHER_NOT_FOUND, message: 'Không tìm thấy voucher' });
    return voucher;
  }

  async remove(id: string) {
    const voucher = await this.vouchers.findOneAndDelete({ voucherId: id }).exec();
    if (!voucher) throw new NotFoundException({ code: ErrorCode.VOUCHER_NOT_FOUND, message: 'Không tìm thấy voucher' });
    return { deleted: true };
  }
}
