import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { TableServiceController } from './table-service.controller.js';
import { TableServiceService } from './table-service.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [TableServiceController],
  providers: [TableServiceService],
})
export class TableServiceModule { }
