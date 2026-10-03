import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@app/common';
import { NotificationServiceService, ReservationEvent } from './notification-service.service.js';

@Controller()
export class NotificationServiceController {
  constructor(private readonly notificationService: NotificationServiceService) {}

  @EventPattern(KAFKA_TOPICS.RESERVATION_CREATED)
  async onReservationCreated(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.notificationService.handleReservationCreated(unwrap(payload));
  }

  @EventPattern(KAFKA_TOPICS.RESERVATION_CANCELLED)
  async onReservationCancelled(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.notificationService.handleReservationCancelled(unwrap(payload));
  }

  @MessagePattern({ cmd: 'list_notifications' })
  listNotifications(@Payload() data: { userId: string }) {
    return this.notificationService.listByUser(data.userId);
  }
}

function unwrap(payload: ReservationEvent | { data: ReservationEvent }): ReservationEvent {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload as ReservationEvent;
}
