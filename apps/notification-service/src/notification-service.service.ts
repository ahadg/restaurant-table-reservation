import { Injectable } from '@nestjs/common';
import { DatabaseService, notifications } from '@app/database';
import { desc, eq } from 'drizzle-orm';

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
export class NotificationServiceService {
  constructor(private readonly dbService: DatabaseService) {}

  async handleReservationCreated(event: ReservationEvent) {
    if (!event.userId) {
      return;
    }

    await this.dbService.db.insert(notifications).values({
      userId: event.userId,
      type: 'RESERVATION_CREATED',
      title: 'Reservation confirmed',
      body: `Your table is booked from ${event.startTime} to ${event.endTime}.`,
      data: event,
    });
  }

  async handleReservationCancelled(event: ReservationEvent) {
    if (!event.userId) {
      return;
    }

    await this.dbService.db.insert(notifications).values({
      userId: event.userId,
      type: 'RESERVATION_CANCELLED',
      title: 'Reservation cancelled',
      body: `Your reservation ${event.id} was cancelled.`,
      data: event,
    });
  }

  async listByUser(userId: string) {
    const rows = await this.dbService.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data || {},
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
