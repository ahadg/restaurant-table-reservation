import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, emailLogs } from '@app/database';

export type ReservationEvent = {
  id: string;
  restaurantId: string;
  tableId: string;
  userId?: string;
  guestName?: string;
  guestEmail?: string;
  startTime: string;
  endTime: string;
  status: string;
  partySize: number;
};

@Injectable()
export class EmailServiceService {
  private readonly logger = new Logger(EmailServiceService.name);

  constructor(private readonly dbService: DatabaseService) {}

  async handleReservationCreated(event: ReservationEvent) {
    await this.send(
      event,
      'Reservation confirmed',
      `Hi ${event.guestName || 'guest'}, your reservation ${event.id} is confirmed for ${event.startTime} (${event.partySize} guests).`,
    );
  }

  async handleReservationCancelled(event: ReservationEvent) {
    await this.send(
      event,
      'Reservation cancelled',
      `Hi ${event.guestName || 'guest'}, your reservation ${event.id} has been cancelled.`,
    );
  }

  private async send(event: ReservationEvent, subject: string, body: string) {
    const to = event.guestEmail;
    if (!to) {
      this.logger.warn(`Skip email for reservation ${event.id}: no guestEmail`);
      return;
    }

    this.logger.log(`Email [${subject}] -> ${to}`);

    await this.dbService.db.insert(emailLogs).values({
      to,
      subject,
      body,
      status: 'SENT',
    });
  }
}
