import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { TableServiceService } from './table-service.service.js';

@Controller()
export class TableServiceController {
  constructor(private readonly tableService: TableServiceService) {}

  @GrpcMethod('TableService', 'ListFloors')
  listFloors(data: { restaurantId: string }) {
    return this.tableService.listFloors(data.restaurantId);
  }

  @GrpcMethod('TableService', 'GetFloor')
  getFloor(data: { id: string }) {
    return this.tableService.getFloor(data.id);
  }

  @GrpcMethod('TableService', 'CreateFloor')
  createFloor(data: { restaurantId: string; name?: string; floorNumber: number }) {
    return this.tableService.createFloor(data);
  }

  @GrpcMethod('TableService', 'UpdateFloor')
  updateFloor(data: { id: string; name?: string; floorNumber?: number }) {
    return this.tableService.updateFloor(data);
  }

  @GrpcMethod('TableService', 'DeleteFloor')
  deleteFloor(data: { id: string }) {
    return this.tableService.deleteFloor(data.id);
  }

  @GrpcMethod('TableService', 'ListTables')
  listTables(data: { restaurantId: string; floorId?: string }) {
    return this.tableService.listTables(data);
  }

  @GrpcMethod('TableService', 'GetTable')
  getTable(data: { id: string }) {
    return this.tableService.getTable(data.id);
  }

  @GrpcMethod('TableService', 'CreateTable')
  createTable(data: {
    restaurantId: string;
    floorId: string;
    ownerId?: string;
    name: string;
    tableNumber: number;
    capacity: number;
  }) {
    return this.tableService.createTable(data);
  }

  @GrpcMethod('TableService', 'UpdateTable')
  updateTable(data: { id: string; name?: string; tableNumber?: number; capacity?: number }) {
    return this.tableService.updateTable(data);
  }

  @GrpcMethod('TableService', 'DeleteTable')
  deleteTable(data: { id: string }) {
    return this.tableService.deleteTable(data.id);
  }

  @GrpcMethod('TableService', 'ListCombinations')
  listCombinations(data: { floorId: string }) {
    return this.tableService.listCombinations(data.floorId);
  }

  @GrpcMethod('TableService', 'CreateCombination')
  createCombination(data: { floorId: string; tableIds: string[] }) {
    return this.tableService.createCombination(data);
  }

  @GrpcMethod('TableService', 'DeleteCombination')
  deleteCombination(data: { id: string }) {
    return this.tableService.deleteCombination(data.id);
  }
}
