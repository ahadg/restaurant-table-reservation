import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { DatabaseService, outboxEvents, type OutboxEvent } from '@app/database';
import { KafkaService } from '@app/kafka';

const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 1_000;
const CLAIM_LEASE_MS = 60_000;
const MAX_RETRY_DELAY_MS = 60_000;

/** Publishes durable outbox rows at least once; consumers must remain idempotent. */
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: NodeJS.Timeout;
  private activePoll?: Promise<void>;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly kafka: KafkaService,
  ) { }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.poll();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.activePoll;
  }

  private poll(): Promise<void> {
    if (this.activePoll) return this.activePoll;
    this.activePoll = this.publishBatch()
      .catch((error: unknown) => this.logger.error(`Outbox poll failed: ${this.errorText(error)}`))
      .finally(() => { this.activePoll = undefined; });
    return this.activePoll;
  }

  private async publishBatch(): Promise<void> {
    const events = await this.claimBatch();
    for (const event of events) {
      await this.publishOne(event);
    }
  }


  private async claimBatch(): Promise<OutboxEvent[]> {
    return this.dbService.db.transaction(async (tx) => {
      const now = new Date();
      const events = await tx
        .select()
        .from(outboxEvents)
        .where(and(
          isNull(outboxEvents.publishedAt),
          lte(outboxEvents.availableAt, now),
          or(isNull(outboxEvents.lockedUntil), lt(outboxEvents.lockedUntil, now)),
        ))
        .orderBy(asc(outboxEvents.createdAt))
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });

      const lockedUntil = new Date(Date.now() + CLAIM_LEASE_MS);
      for (const event of events) {
        await tx.update(outboxEvents)
          .set({ lockedUntil })
          .where(eq(outboxEvents.id, event.id));
      }
      return events;
    });
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    try {
      await this.kafka.emit(event.topic, event.payload, {
        eventId: event.id,
        key: event.messageKey ?? undefined,
      });
      await this.dbService.db.update(outboxEvents)
        .set({ publishedAt: new Date(), lockedUntil: null, lastError: null })
        .where(eq(outboxEvents.id, event.id));
    } catch (error) {
      const attempts = event.attempts + 1;
      const retryDelayMs = Math.min(1_000 * 2 ** Math.min(attempts - 1, 6), MAX_RETRY_DELAY_MS);
      const message = this.errorText(error).slice(0, 4_000);

      try {
        await this.dbService.db.update(outboxEvents)
          .set({
            attempts,
            availableAt: new Date(Date.now() + retryDelayMs),
            lockedUntil: null,
            lastError: message,
          })
          .where(eq(outboxEvents.id, event.id));
      } catch (updateError) {
        // Leave the lease in place; another poll can retry after it expires.
        this.logger.error(`Could not reschedule outbox event ${event.id}: ${this.errorText(updateError)}`);
      }

      this.logger.warn(`Outbox event ${event.id} to ${event.topic} failed (attempt ${attempts}); retrying in ${retryDelayMs}ms: ${message}`);
    }
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
