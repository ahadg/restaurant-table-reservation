import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { KafkaModule } from '@app/kafka';
import { ReservationServiceController } from './reservation-service.controller.js';
import { ReservationServiceService } from './reservation-service.service.js';
import { OutboxPublisherService } from './outbox/outbox-publisher.service.js';

@Module({
  imports: [DatabaseModule, KafkaModule],
  controllers: [ReservationServiceController],
  providers: [ReservationServiceService, OutboxPublisherService],
})
export class ReservationServiceModule {}
