import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { UserActivity, UserActivitySchema } from './schemas/user-activity.schema';
import { UserActivitiesController } from './user-activities.controller';
import { UserActivitiesService } from './user-activities.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: UserActivity.name, schema: UserActivitySchema },
    { name: Customer.name, schema: CustomerSchema },
  ])],
  controllers: [UserActivitiesController],
  providers: [UserActivitiesService],
  exports: [MongooseModule],
})
export class UserActivitiesModule {}
