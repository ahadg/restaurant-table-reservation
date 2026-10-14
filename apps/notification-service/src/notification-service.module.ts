import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '@app/database';
import { KafkaRetryInterceptor } from '@app/kafka';
import { NotificationServiceController } from './notification-service.controller.js';
import { NotificationServiceService } from './notification-service.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationServiceController],
  providers: [
    NotificationServiceService,
    // Retries failed events, then parks them on <topic>.dlq. Only Kafka
    // contexts are touched, so the TCP list_notifications handler is unaffected.
    { provide: APP_INTERCEPTOR, useClass: KafkaRetryInterceptor },
  ],
})
export class NotificationServiceModule {}
