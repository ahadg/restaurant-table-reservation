import { Controller, Get, Post } from '@nestjs/common';
import { TableServiceService } from './table-service.service.js';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class TableServiceController {
  constructor(private readonly tableServiceService: TableServiceService) { }

  @GrpcMethod('TableService', 'addFloor')
  addFloor(data: { restaurantId: string, name: string, floorNumber: number }): Promise<any> {
    return this.tableServiceService.insertFloor(data);
  }

  @GrpcMethod('TableService', 'getFloors')
  getFloors(data: { restaurantId: string }): Promise<any> {
    return this.tableServiceService.getfloor(data.restaurantId);
  }
}
