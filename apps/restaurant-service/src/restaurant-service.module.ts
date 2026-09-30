import { Module } from '@nestjs/common';
import { RestaurantServiceController } from './restaurant-service.controller.js';
import { RestaurantServiceService } from './restaurant-service.service.js';

@Module({
  imports: [],
  controllers: [RestaurantServiceController],
  providers: [RestaurantServiceService],
})
export class RestaurantServiceModule {}
