import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@app/common';
import { NotificationServiceService, ReservationEvent } from './notification-service.service.js';

@Controller()
export class NotificationServiceController {
  constructor(private readonly notificationService: NotificationServiceService) { }
  //logger":"kafkajs","broker":"localhost:9092","clientId":"notification-service-server",
  //"error":"The request attempted to perform an operation on an invalid topic","correlationId":1,"size":220}

  // This app is a hybrid (TCP + Kafka). Omitting the transport binds a handler to
  // every connected transport, so the Kafka server would try to subscribe to a topic
  // named after the pattern.
  @EventPattern(KAFKA_TOPICS.RESERVATION_CREATED, Transport.KAFKA)
  async onReservationCreated(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.notificationService.handleReservationCreated(unwrap(payload));
  }

  @EventPattern(KAFKA_TOPICS.RESERVATION_CANCELLED, Transport.KAFKA)
  async onReservationCancelled(@Payload() payload: ReservationEvent | { data: ReservationEvent }) {
    await this.notificationService.handleReservationCancelled(unwrap(payload));
  }

  // TCP only: an object pattern normalizes to `{"cmd":"list_notifications"}`, which is
  // not a legal Kafka topic name (Kafka allows only [a-zA-Z0-9._-]).
  @MessagePattern({ cmd: 'list_notifications' }, Transport.TCP)
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
