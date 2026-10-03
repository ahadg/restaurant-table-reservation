import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { EmailServiceController } from './email-service.controller.js';
import { EmailServiceService } from './email-service.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [EmailServiceController],
  providers: [EmailServiceService],
})
export class EmailServiceModule {}
