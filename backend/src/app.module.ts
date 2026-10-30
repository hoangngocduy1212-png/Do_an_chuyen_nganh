import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import configuration, { environmentValidationSchema } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { UsersModule } from './modules/users/users.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { StoresModule } from './modules/stores/stores.module';
import { CartsModule } from './modules/carts/carts.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminDashboardModule } from './modules/admin-dashboard/admin-dashboard.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UserActivitiesModule } from './modules/user-activities/user-activities.module';
import { AiFeedbackModule } from './modules/ai-feedback/ai-feedback.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema: environmentValidationSchema, envFilePath: ['.env', '../.env'] }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    MailModule,
    CategoriesModule,
    ProductsModule,
    StoresModule,
    CartsModule,
    VouchersModule,
    PaymentsModule,
    InventoryModule,
    OrdersModule,
    AdminDashboardModule,
    MembershipsModule,
    ReviewsModule,
    UserActivitiesModule,
    AiFeedbackModule,
    RecommendationsModule,
    ChatModule,
    // Them module moi (products, orders, ...) vao day
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // moi endpoint can JWT, tru @Public()
    { provide: APP_GUARD, useClass: RolesGuard },   // kiem tra @Roles()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
