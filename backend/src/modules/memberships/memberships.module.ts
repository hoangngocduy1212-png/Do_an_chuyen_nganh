import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { MembershipLevel, MembershipLevelSchema } from '../membership-levels/schemas/membership-level.schema';
import { PointTransaction, PointTransactionSchema } from '../point-transactions/schemas/point-transaction.schema';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { Membership, MembershipSchema } from './schemas/membership.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Membership.name, schema: MembershipSchema },
    { name: MembershipLevel.name, schema: MembershipLevelSchema },
    { name: PointTransaction.name, schema: PointTransactionSchema },
    { name: Customer.name, schema: CustomerSchema },
  ])],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MongooseModule],
})
export class MembershipsModule {}
