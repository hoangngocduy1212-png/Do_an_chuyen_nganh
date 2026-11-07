import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiClientModule } from '../ai-client/ai-client.module';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { ForecastsController } from './forecasts.controller';
import { ForecastsService } from './forecasts.service';

@Module({
  imports: [AiClientModule, MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }])],
  controllers: [ForecastsController],
  providers: [ForecastsService],
})
export class ForecastsModule {}
