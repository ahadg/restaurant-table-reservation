import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService, reservations, restaurantTable } from '@app/database';
import { KafkaService } from '@app/kafka';
import { KAFKA_TOPICS } from '@app/common';
import { and, count, desc, eq, gt, lt, ne, type SQL } from 'drizzle-orm';

@Injectable()
export class ReservationServiceService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly kafka: KafkaService,
  ) {}

  async createReservation(data: {
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
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new RpcException({
        code: 3,
        message: 'endTime must be after startTime',
      });
    }

    const [table] = await this.dbService.db
      .select()
      .from(restaurantTable)
      .where(eq(restaurantTable.id, data.tableId));

    if (!table) {
      throw new RpcException({
        code: 5,
        message: `Table with ID ${data.tableId} not found`,
      });
    }

    if (table.restaurantId !== data.restaurantId) {
      throw new RpcException({
        code: 3,
        message: 'Table does not belong to this restaurant',
      });
    }

    if (data.partySize > table.capacity) {
      throw new RpcException({
        code: 3,
        message: `Party size exceeds table capacity of ${table.capacity}`,
      });
    }

    const overlapping = await this.dbService.db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.tableId, data.tableId),
          ne(reservations.status, 'CANCELLED'),
          lt(reservations.startTime, end),
          gt(reservations.endTime, start),
        ),
      )
      .limit(1);

    if (overlapping.length > 0) {
      throw new RpcException({
        code: 6,
        message: 'Table is already reserved for that time window',
      });
    }

    const [row] = await this.dbService.db
      .insert(reservations)
      .values({
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        userId: data.userId || null,
        guestName: data.guestName || null,
        guestEmail: data.guestEmail || null,
        guestPhone: data.guestPhone || null,
        partySize: data.partySize,
        startTime: start,
        endTime: end,
        status: 'CONFIRMED',
        notes: data.notes || null,
      })
      .returning();

    const payload = this.formatReservation(row);
    await this.kafka.emit(KAFKA_TOPICS.RESERVATION_CREATED, payload);
    return payload;
  }

  async getReservation(id: string) {
    const [row] = await this.dbService.db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return this.formatReservation(row);
  }

  async listReservations(data: { userId?: string; restaurantId?: string; page?: number; limit?: number }) {
    const page = data.page && data.page > 0 ? data.page : 1;
    const limit = data.limit && data.limit > 0 ? data.limit : 10;
    const offset = (page - 1) * limit;
    const filters: SQL[] = [];

    if (data.userId) {
      filters.push(eq(reservations.userId, data.userId));
    }
    if (data.restaurantId) {
      filters.push(eq(reservations.restaurantId, data.restaurantId));
    }

    const where = filters.length ? and(...filters) : undefined;

    const items = await this.dbService.db
      .select()
      .from(reservations)
      .where(where)
      .orderBy(desc(reservations.startTime))
      .limit(limit)
      .offset(offset);

    const [{ value: totalCount }] = await this.dbService.db
      .select({ value: count() })
      .from(reservations)
      .where(where);

    return {
      reservations: items.map((row) => this.formatReservation(row)),
      total: Number(totalCount),
    };
  }

  async cancelReservation(data: { id: string; userId?: string }) {
    const existing = await this.getRaw(data.id);

    if (data.userId && existing.userId && existing.userId !== data.userId) {
      throw new RpcException({
        code: 7,
        message: 'You can only cancel your own reservation',
      });
    }

    if (existing.status === 'CANCELLED') {
      return this.formatReservation(existing);
    }

    const [row] = await this.dbService.db
      .update(reservations)
      .set({ status: 'CANCELLED' })
      .where(eq(reservations.id, data.id))
      .returning();

    const payload = this.formatReservation(row);
    await this.kafka.emit(KAFKA_TOPICS.RESERVATION_CANCELLED, payload);
    return payload;
  }

  private async getRaw(id: string) {
    const [row] = await this.dbService.db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    if (!row) {
      throw new RpcException({
        code: 5,
        message: `Reservation with ID ${id} not found`,
      });
    }

    return row;
  }

  private formatReservation(row: typeof reservations.$inferSelect) {
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      tableId: row.tableId,
      userId: row.userId || '',
      guestName: row.guestName || '',
      guestEmail: row.guestEmail || '',
      guestPhone: row.guestPhone || '',
      partySize: row.partySize,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
      status: row.status,
      notes: row.notes || '',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
