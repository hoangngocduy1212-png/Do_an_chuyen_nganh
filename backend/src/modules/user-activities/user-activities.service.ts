import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer } from '../customers/schemas/customer.schema';
import { UserActivity } from './schemas/user-activity.schema';

@Injectable()
export class UserActivitiesService {
  constructor(
    @InjectModel(UserActivity.name) private readonly activities: Model<UserActivity>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
  ) {}

  async record(
    dto: { activityType: string; productId?: string; searchQuery?: string; anonymousId?: string },
    userId?: string,
  ): Promise<void> {
    const customer = userId ? await this.customers.findOne({ userId }).select('customerId').lean().exec() : null;
    await this.activities.create({
      activityType: dto.activityType,
      productId: dto.productId,
      searchQuery: dto.searchQuery,
      customerId: customer?.customerId,
      anonymousId: customer ? undefined : dto.anonymousId,
    });
  }
}
