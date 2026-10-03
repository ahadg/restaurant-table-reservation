import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { NotificationServiceController } from './notification-service.controller.js';
import { NotificationServiceService } from './notification-service.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService],
})
export class NotificationServiceModule {}
