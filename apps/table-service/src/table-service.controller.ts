import { Controller, Get } from '@nestjs/common';
import { TableServiceService } from './table-service.service.js';

@Controller()
export class TableServiceController {
  constructor(private readonly tableServiceService: TableServiceService) {}

  @Get()
  getHello(): string {
    return this.tableServiceService.getHello();
  }
}
