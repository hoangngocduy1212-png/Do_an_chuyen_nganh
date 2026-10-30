import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Customer } from '../customers/schemas/customer.schema';
import { MembershipLevel } from '../membership-levels/schemas/membership-level.schema';
import { PointTransaction } from '../point-transactions/schemas/point-transaction.schema';
import { Membership } from './schemas/membership.schema';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(MembershipLevel.name) private readonly levels: Model<MembershipLevel>,
    @InjectModel(PointTransaction.name) private readonly transactionsModel: Model<PointTransaction>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
  ) {}

  async summary(userId: string) {
    const customerId = await this.customerId(userId);
    const [membership, levels] = await Promise.all([
      this.memberships.findOne({ customerId }).lean().exec(),
      this.levels.find().sort({ sortOrder: 1 }).lean().exec(),
    ]);
    if (!membership) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy thông tin thành viên' });
    return {
      pointBalance: membership.pointBalance,
      lifetimePoints: membership.lifetimePoints,
      memberLevel: membership.memberLevel,
      memberCode: membership.memberCode,
      levels: levels.map((level) => ({ name: level.name, minPoints: level.minPoints, benefits: level.benefits.join(', ') })),
    };
  }

  async transactions(userId: string, page: number, limit: number) {
    const customerId = await this.customerId(userId);
    const [rows, total] = await Promise.all([
      this.transactionsModel.find({ customerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.transactionsModel.countDocuments({ customerId }).exec(),
    ]);
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        description: row.note,
        points: row.type === 'REDEEM' ? -Math.abs(row.points) : row.points,
        createdAt: (row as unknown as { createdAt: Date }).createdAt.toISOString(),
        balanceAfter: row.balanceAfter,
      })),
      page,
      limit,
      total,
    };
  }

  private async customerId(userId: string): Promise<string> {
    const customer = await this.customers.findOne({ userId }).select('customerId').lean().exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    return customer.customerId;
  }
}
