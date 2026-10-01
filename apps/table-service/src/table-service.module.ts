import { Module } from '@nestjs/common';
import { TableServiceController } from './table-service.controller.js';
import { TableServiceService } from './table-service.service.js';

@Module({
  imports: [],
  controllers: [TableServiceController],
  providers: [TableServiceService],
})
export class TableServiceModule {}
