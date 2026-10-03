import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    text,
    index,
    pgEnum,
    check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const reservationStatusEnum = pgEnum("reservation_status", [
    "PENDING",
    "CONFIRMED",
    "CANCELLED",
    "COMPLETED",
]);

export const reservations = pgTable(
    "reservations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        restaurantId: uuid("restaurant_id").notNull(),
        tableId: uuid("table_id").notNull(),
        userId: uuid("user_id"),
        guestName: varchar("guest_name", { length: 255 }),
        guestEmail: varchar("guest_email", { length: 255 }),
        guestPhone: varchar("guest_phone", { length: 50 }),
        partySize: integer("party_size").notNull(),
        startTime: timestamp("start_time", { withTimezone: true }).notNull(),
        endTime: timestamp("end_time", { withTimezone: true }).notNull(),
        status: reservationStatusEnum("status").default("CONFIRMED").notNull(),
        notes: text("notes"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (t) => [
        index("reservations_restaurant_idx").on(t.restaurantId),
        index("reservations_table_idx").on(t.tableId),
        index("reservations_user_idx").on(t.userId),
        index("reservations_time_idx").on(t.startTime, t.endTime),
        check("reservations_party_size_positive", sql`${t.partySize} > 0`),
    ]
);

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
