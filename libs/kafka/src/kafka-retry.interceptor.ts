import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, mergeMap, retry } from 'rxjs/operators';
import { metrics } from '@opentelemetry/api';
import { kafkaRetryOptions, type DlqEnvelope, type KafkaRetryOptions } from './kafka-retry.options.js';

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Retries a failing Kafka message handler with exponential backoff, then moves
 * the message to `<topic>.dlq` instead of dropping it.
 *
 * Applying to Kafka contexts only: `switchToRpc().getContext()` is a KafkaContext
 * for Kafka and something else entirely for TCP, so a hybrid app (like
 * notification-service) retries its events without touching its request/response
 * handlers.
 *
 * The handler error is swallowed only after the DLQ write succeeds. If the DLQ
 * write fails, rethrow so Kafka does not acknowledge the only remaining copy.
 */
@Injectable()
export class KafkaRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(KafkaRetryInterceptor.name);
  private readonly options: KafkaRetryOptions = kafkaRetryOptions();
  private readonly dlqPublished = metrics.getMeter('restaurant-kafka').createCounter('kafka_dlq_published');
  private readonly dlqPublishFailed = metrics.getMeter('restaurant-kafka').createCounter('kafka_dlq_publish_failed');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const kafka = this.kafkaContext(context);
    if (!this.options.enabled || !kafka) {
      return next.handle();
    }

    const topic = kafka.getTopic();
    const retries = this.options.attempts - 1;

    return next.handle().pipe(
      retry({
        count: retries,
        delay: (error: unknown, attempt: number) => {
          const wait = Math.min(
            this.options.initialDelayMs * 2 ** (attempt - 1),
            this.options.maxDelayMs,
          );
          this.logger.warn(
            `Retry ${attempt}/${retries} for ${topic} (partition ${kafka.getPartition()}, offset ${kafka.getMessage().offset}) in ${wait}ms: ${errorText(error)}`,
          );
          return timer(wait);
        },
      }),
      catchError((error: unknown) =>
        // Handled (and deliberately swallowed) once it is on the DLQ.
        from(this.moveToDlq(kafka, error)).pipe(mergeMap(() => of(undefined))),
      ),
    );
  }

  private kafkaContext(context: ExecutionContext): KafkaContext | null {
    if (context.getType() !== 'rpc') {
      return null;
    }
    const ctx = context.switchToRpc().getContext<KafkaContext>();
    if (ctx instanceof KafkaContext) {
      return ctx;
    }
    // Duck-type as a fallback: for other transports the context is the payload.
    const candidate = ctx as unknown as Partial<KafkaContext> | undefined;
    return typeof candidate?.getTopic === 'function' && typeof candidate?.getMessage === 'function'
      ? (ctx as KafkaContext)
      : null;
  }

  private async moveToDlq(kafka: KafkaContext, error: unknown): Promise<void> {
    const sourceTopic = kafka.getTopic();
    const partition = kafka.getPartition();
    const message = kafka.getMessage();
    const dlqTopic = `${sourceTopic}${this.options.dlqSuffix}`;
    const failedAt = new Date().toISOString();
    const reason = errorText(error);

    const envelope = this.buildEnvelope(sourceTopic, partition, message.offset, failedAt, reason, message.value);

    try {
      await kafka.getProducer().send({
        topic: dlqTopic,
        messages: [
          {
            key: message.key ?? null,
            value: JSON.stringify(envelope),
            headers: {
              'x-dlq-source-topic': sourceTopic,
              'x-dlq-source-offset': String(message.offset),
              'x-dlq-attempts': String(this.options.attempts),
              'x-dlq-failed-at': failedAt,
              'x-dlq-error': reason.slice(0, 500),
            },
          },
        ],
      });
      this.dlqPublished.add(1, { source_topic: sourceTopic });
      this.logger.error(
        `Gave up on ${sourceTopic} (partition ${partition}, offset ${message.offset}) after ${this.options.attempts} attempts -> ${dlqTopic}: ${reason}`,
      );
    } catch (publishError) {
      this.dlqPublishFailed.add(1, { source_topic: sourceTopic });
      this.logger.error(
        `FAILED to write ${sourceTopic} (partition ${partition}, offset ${message.offset}) to ${dlqTopic}: ${errorText(publishError)}. ` +
          `The source message will remain unacknowledged and Kafka will retry it.`,
      );
      throw publishError;
    }
  }

  private buildEnvelope(
    sourceTopic: string,
    partition: number,
    offset: string,
    failedAt: string,
    reason: string,
    value: unknown,
  ): DlqEnvelope {
    let original: { pattern?: string; data?: unknown } = {};
    try {
      const parsed = JSON.parse(this.toText(value));
      if (parsed && typeof parsed === 'object') {
        original = parsed as { pattern?: string; data?: unknown };
      }
    } catch {
      // Not the { pattern, data } shape; keep whatever we got so nothing is lost.
      original = { pattern: sourceTopic, data: this.toText(value) };
    }

    return {
      pattern: original.pattern ?? sourceTopic,
      data: original.data ?? null,
      dlq: {
        sourceTopic,
        partition,
        offset: String(offset),
        attempts: this.options.attempts,
        failedAt,
        error: reason,
      },
    };
  }

  private toText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  }
}
