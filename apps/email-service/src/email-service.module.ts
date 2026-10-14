import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '@app/database';
import { KafkaRetryInterceptor } from '@app/kafka';
import { EmailServiceController } from './email-service.controller.js';
import { EmailServiceService } from './email-service.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [EmailServiceController],
  providers: [
    EmailServiceService,
    // Retries failed events, then parks them on <topic>.dlq.
    { provide: APP_INTERCEPTOR, useClass: KafkaRetryInterceptor },
  ],
})
export class EmailServiceModule {}
