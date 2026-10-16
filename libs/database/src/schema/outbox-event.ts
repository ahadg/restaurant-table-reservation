import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Durable Kafka work, inserted in the same transaction as its business change. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topic: varchar('topic', { length: 255 }).notNull(),
    messageKey: varchar('message_key', { length: 255 }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
  },
  (table) => [
    index('outbox_events_pending_idx').on(table.publishedAt, table.availableAt, table.lockedUntil),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
