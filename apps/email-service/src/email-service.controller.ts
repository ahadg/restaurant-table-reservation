import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@app/common';
import { EmailServiceService, ReservationEvent } from './email-service.service.js';

@Controller()
export class EmailServiceController {
  constructor(private readonly emailService: EmailServiceService) {}

  @EventPattern(KAFKA_TOPICS.RESERVATION_CREATED)
  async onReservationCreated(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.emailService.handleReservationCreated(unwrap(payload));
  }

  @EventPattern(KAFKA_TOPICS.RESERVATION_CANCELLED)
  async onReservationCancelled(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.emailService.handleReservationCancelled(unwrap(payload));
  }
}

function unwrap(payload: ReservationEvent | { data: ReservationEvent }): ReservationEvent {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload as ReservationEvent;
}
