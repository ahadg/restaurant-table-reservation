import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { RedisService } from '@app/redis';
import { createKafkaClient } from '@app/kafka';

type DlqMessage = {
  id: string;
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  headers: Record<string, string>;
  envelope: Record<string, any> | null;
  raw: string;
  replayStatus: string | null;
};

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);
  private readonly kafka: Kafka = createKafkaClient('restaurant-dlq-admin');

  constructor(private readonly redis: RedisService) { }

  /**
   * List a page of messages from every topic ending in the configured DLQ suffix.
   * `offset` is a UI pagination position within each topic, not a Kafka message
   * offset. Kafka offsets are still included on each returned message as `offset`.
   */
  async listMessages(limit = 100, offset = 0) {
    // Clamp query values so a caller cannot request an unbounded Kafka scan/page.
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const safeOffset = Math.max(0, Math.min(Number(offset) || 0, 100_000));
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const suffix = process.env.KAFKA_DLQ_SUFFIX || '.dlq';
      const topics = (await admin.listTopics()).filter((topic) => topic.endsWith(suffix)).sort();
      // For each topic, read enough records to cover the requested page plus one
      // extra record. That extra record lets us determine whether another page exists.
      const pages = await Promise.all(topics.map(async (topic) => ({
        records: await this.readTopic(topic, safeOffset + safeLimit + 1),
      })));
      // True when at least one DLQ topic has a record after this page's end.
      const hasMore = pages.some(({ records }) => records.length > safeOffset + safeLimit);
      // Apply the same page position separately to each topic, then combine results.
      const messages = pages.flatMap(({ records }) => records.slice(safeOffset, safeOffset + safeLimit));
      // Cache the message reference briefly: replay accepts only messages recently
      // listed here, so callers must refresh before replaying an old/stale reference.
      await Promise.all(messages.map((message) => this.redis.client.set(
        this.messageKey(message.id), JSON.stringify(message), 'EX', 600,
      )));
      // Replay status lives separately from the cached message and can survive page refreshes.
      const withStatus = await Promise.all(messages.map(async (message) => ({
        ...message,
        replayStatus: await this.redis.client.get(this.statusKey(message.id)),
      })));
      return {
        topics,
        limitPerTopic: safeLimit,
        offsetPerTopic: safeOffset,
        hasMore,
        messages: withStatus.sort((a, b) => b.headers['x-dlq-failed-at']?.localeCompare(a.headers['x-dlq-failed-at'] ?? '') ?? 0),
      };
    } finally {
      await admin.disconnect();
    }
  }

  /** Public demo listing is deliberately restricted to the synthetic demo DLQ topic. */
  async listDemoMessages(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const demoTopic = `dlq.demo${process.env.KAFKA_DLQ_SUFFIX || '.dlq'}`;
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      if (!(await admin.listTopics()).includes(demoTopic)) {
        return { topics: [], limitPerTopic: safeLimit, hasMore: false, messages: [] };
      }
      // Demo always starts at the first retained record; its page has no offset control.
      const records = await this.readTopic(demoTopic, safeLimit + 1);
      const messages = records.slice(0, safeLimit);
      await Promise.all(messages.map((message) => this.redis.client.set(
        this.messageKey(message.id), JSON.stringify(message), 'EX', 600,
      )));
      const withStatus = await Promise.all(messages.map(async (message) => ({
        ...message,
        replayStatus: await this.redis.client.get(this.statusKey(message.id)),
      })));
      return {
        topics: [demoTopic],
        limitPerTopic: safeLimit,
        hasMore: records.length > safeLimit,
        messages: withStatus,
      };
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Public demo replay entry point. It refuses any message ID outside the demo
   * DLQ and always sends the replay to the unconsumed `dlq.demo` source topic.
   */
  replayDemo(input: { id: string; data: unknown }) {
    const demoTopic = `dlq.demo${process.env.KAFKA_DLQ_SUFFIX || '.dlq'}`;
    if (!input.id.startsWith(`${demoTopic}|`)) {
      throw new BadRequestException('Only messages from the isolated demo DLQ can be replayed publicly');
    }
    return this.replay({ id: input.id, sourceTopic: 'dlq.demo', data: input.data });
  }

  /** Validate a listed DLQ record, republish its corrected payload, and track the result. */
  async replay(input: { id: string; sourceTopic: string; data: unknown }) {
    if (!input.id || !input.sourceTopic || !input.sourceTopic.match(/^[a-zA-Z0-9._-]+$/) || input.data === undefined) {
      throw new BadRequestException('A valid DLQ message id, source topic, and event payload are required');
    }
    // A record must have been listed recently; Redis supplies the authoritative
    // topic/partition/offset details instead of trusting those details from the request.
    const cached = await this.redis.client.get(this.messageKey(input.id));
    if (!cached) throw new BadRequestException('Refresh the DLQ page before replaying this message');
    const message = JSON.parse(cached) as DlqMessage;
    const suffix = process.env.KAFKA_DLQ_SUFFIX || '.dlq';
    const [dlqTopic, partitionText, offset] = input.id.split('|');
    const sourceTopic = message.envelope?.dlq?.sourceTopic ||
      (message.topic.endsWith(suffix) ? message.topic.slice(0, -suffix.length) : '');
    if (message.topic !== `${input.sourceTopic}${suffix}` || dlqTopic !== message.topic ||
      partitionText !== String(message.partition) || offset !== message.offset || sourceTopic !== input.sourceTopic) {
      throw new BadRequestException('DLQ message reference does not match its source topic');
    }

    // NX makes this a single-winner lock: two clicks/processes cannot replay the
    // same DLQ record concurrently. The expiry releases it if a process crashes.
    const lockKey = `${this.statusKey(input.id)}:lock`;
    const claimed = await this.redis.client.set(lockKey, 'replaying', 'EX', 120, 'NX');
    if (claimed !== 'OK') {
      throw new BadRequestException('This message is already being replayed');
    }
    const producer = this.kafka.producer();
    try {
      await producer.connect();
      await producer.send({
        topic: sourceTopic,
        messages: [{
          key: message.key,
          value: JSON.stringify({ pattern: sourceTopic, data: input.data }),
          headers: {
            'x-dlq-replayed-at': new Date().toISOString(),
            'x-dlq-original-id': input.id,
          },
        }],
      });
      // Keep an audit hash with when/where the message was replayed, and a simple
      // status value for quickly decorating the UI row.
      await this.redis.client.hset(this.auditKey(input.id), {
        status: 'REPLAYED',
        replayedAt: new Date().toISOString(),
        sourceTopic,
      });
      await this.redis.client.set(this.statusKey(input.id), 'REPLAYED');
      this.logger.warn(`DLQ message ${input.id} replayed to ${sourceTopic}`);
      return { ok: true, status: 'REPLAYED', id: input.id };
    } catch (error) {
      await this.redis.client.hset(this.auditKey(input.id), {
        status: 'REPLAY_FAILED',
        replayedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      await this.redis.client.set(this.statusKey(input.id), 'REPLAY_FAILED');
      throw error;
    } finally {
      await producer.disconnect().catch(() => undefined);
      await this.redis.client.del(lockKey);
    }
  }

  /** one Kafka topic and turns them into objects the DLQ page can display. being used in listmessage */
  private async readTopic(topic: string, limit: number): Promise<DlqMessage[]> {
    // real application consumer group or changing its progress.
    const consumer = this.kafka.consumer({ groupId: `dlq-ui-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    const messages: DlqMessage[] = [];
    let finish!: () => void;
    const reachedLimit = new Promise<void>((resolve) => { finish = resolve; });
    await consumer.connect();
    try {
      await consumer.subscribe({ topic, fromBeginning: true });
      const run = consumer.run({
        eachMessage: async ({ topic: messageTopic, partition, message }) => {
          const headers = Object.fromEntries(Object.entries(message.headers ?? {}).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.map((part) => part.toString()).join(',') : value?.toString() ?? '',
          ]));
          const raw = message.value?.toString() ?? '';
          // Parsed envelope is convenient for the UI; `raw` is retained so malformed
          // messages remain inspectable instead of disappearing from the DLQ view.
          let envelope: Record<string, any> | null = null;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') envelope = parsed;
          } catch { /* expose raw malformed records for diagnosis */ }
          messages.push({
            id: `${messageTopic}|${partition}|${message.offset}`,
            topic: messageTopic,
            partition,
            offset: message.offset,
            key: message.key?.toString() ?? null,
            headers,
            envelope,
            raw,
            replayStatus: null,
          });
          if (messages.length >= limit) finish();
        },
      });
      // Stop once we have enough records, or after 1.5s if the requested count is
      // unavailable, so an empty/small topic does not leave this read hanging.
      await Promise.race([reachedLimit, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
      await consumer.stop();
      await run;
      // Return the earliest retained offsets in a bounded page.
      return messages.slice(0, limit);
    } finally {
      await consumer.disconnect().catch(() => undefined);
    }
  }

  /** Redis key for the current replay state shown in the UI. */
  private statusKey(id: string) { return `dlq:status:${Buffer.from(id).toString('base64url')}`; }
  /** Redis key for a short-lived snapshot used to validate replay requests. */
  private messageKey(id: string) { return `dlq:message:${Buffer.from(id).toString('base64url')}`; }
  /** Redis key for replay audit details (status, time, destination, or error). */
  private auditKey(id: string) { return `dlq:audit:${Buffer.from(id).toString('base64url')}`; }

}
