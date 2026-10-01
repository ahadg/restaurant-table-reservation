import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RestaurantServiceService } from './restaurant-service.service.js';

@Controller()
export class RestaurantServiceController {
  constructor(private readonly restaurantService: RestaurantServiceService) {}

  @GrpcMethod('RestaurantService', 'CreateRestaurant')
  createRestaurant(data: any) {
    return this.restaurantService.createRestaurant(data);
  }

  @GrpcMethod('RestaurantService', 'GetRestaurant')
  getRestaurant(data: { id: string }) {
    return this.restaurantService.getRestaurant(data.id);
  }

  @GrpcMethod('RestaurantService', 'ListRestaurants')
  listRestaurants(data: { page?: number; limit?: number }) {
    return this.restaurantService.listRestaurants(data.page || 1, data.limit || 10);
  }

  @GrpcMethod('RestaurantService', 'UpdateRestaurant')
  updateRestaurant(data: any) {
    return this.restaurantService.updateRestaurant(data);
  }

  @GrpcMethod('RestaurantService', 'DeleteRestaurant')
  deleteRestaurant(data: { id: string }) {
    return this.restaurantService.deleteRestaurant(data.id);
  }

  @GrpcMethod('RestaurantService', 'AddLocation')
  addLocation(data: any) {
    return this.restaurantService.addLocation(data);
  }

  @GrpcMethod('RestaurantService', 'SetOpeningHours')
  setOpeningHours(data: any) {
    return this.restaurantService.setOpeningHours(data);
  }

  @GrpcMethod('RestaurantService', 'AddHouseRule')
  addHouseRule(data: any) {
    return this.restaurantService.addHouseRule(data);
  }
}
