import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    text,
    index,
    jsonb,
    uniqueIndex,
} from "drizzle-orm/pg-core";

export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id").notNull(),
        eventId: varchar("event_id", { length: 100 }),
        type: varchar("type", { length: 100 }).notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        body: text("body").notNull(),
        data: jsonb("data").$type<Record<string, unknown>>(),
        readAt: timestamp("read_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        index("notifications_user_idx").on(t.userId),
        uniqueIndex("notifications_event_unique").on(t.userId, t.type, t.eventId),
    ]
);

export const emailLogs = pgTable(
    "email_logs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        eventId: varchar("event_id", { length: 100 }),
        to: varchar("to_address", { length: 255 }).notNull(),
        subject: varchar("subject", { length: 255 }).notNull(),
        body: text("body").notNull(),
        status: varchar("status", { length: 50 }).default("SENT").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        index("email_logs_to_idx").on(t.to),
        uniqueIndex("email_logs_event_subject_unique").on(t.eventId, t.subject),
    ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
