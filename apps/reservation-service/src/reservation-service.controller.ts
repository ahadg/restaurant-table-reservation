import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReservationServiceService } from './reservation-service.service.js';

@Controller()
export class ReservationServiceController {
  constructor(private readonly reservationService: ReservationServiceService) {}

  @GrpcMethod('ReservationService', 'CreateReservation')
  createReservation(data: {
    restaurantId: string;
    tableId: string;
    userId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    partySize: number;
    startTime: string;
    endTime: string;
    notes?: string;
  }) {
    return this.reservationService.createReservation(data);
  }

  @GrpcMethod('ReservationService', 'GetReservation')
  getReservation(data: { id: string }) {
    return this.reservationService.getReservation(data.id);
  }

  @GrpcMethod('ReservationService', 'ListReservations')
  listReservations(data: { userId?: string; restaurantId?: string; page?: number; limit?: number }) {
    return this.reservationService.listReservations(data);
  }

  @GrpcMethod('ReservationService', 'CancelReservation')
  cancelReservation(data: { id: string; userId?: string }) {
    return this.reservationService.cancelReservation(data);
  }
}
