import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { KafkaModule } from '@app/kafka';
import { ReservationServiceController } from './reservation-service.controller.js';
import { ReservationServiceService } from './reservation-service.service.js';

@Module({
  imports: [DatabaseModule, KafkaModule],
  controllers: [ReservationServiceController],
  providers: [ReservationServiceService],
})
export class ReservationServiceModule {}
