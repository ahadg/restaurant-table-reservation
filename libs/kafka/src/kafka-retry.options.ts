export interface KafkaRetryOptions {
  /** Total attempts including the first try. Default 3. */
  attempts: number;
  /** Backoff for the first retry; doubles each attempt. Default 500ms. */
  initialDelayMs: number;
  /** Ceiling for the backoff. Default 10000ms. */
  maxDelayMs: number;
  /** Topic suffix for the dead letter queue. Default '.dlq'. */
  dlqSuffix: string;
  /** Set KAFKA_RETRY_ENABLED=false to disable retry and DLQ handling. */
  enabled: boolean;
}

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function kafkaRetryOptions(): KafkaRetryOptions {
  return {
    attempts: Math.max(1, intFromEnv('KAFKA_RETRY_ATTEMPTS', 3)),
    initialDelayMs: intFromEnv('KAFKA_RETRY_INITIAL_DELAY_MS', 500),
    maxDelayMs: intFromEnv('KAFKA_RETRY_MAX_DELAY_MS', 10_000),
    dlqSuffix: process.env.KAFKA_DLQ_SUFFIX || '.dlq',
    enabled: process.env.KAFKA_RETRY_ENABLED !== 'false',
  };
}

/**
 * Shape written to the DLQ topic.
 *
 * `pattern` + `data` are kept exactly as the original message had them, so
 * replaying is just producing this object's `pattern`/`data` back to the source
 * topic - see scripts/dlq.mjs. `dlq` carries the failure context and is ignored
 * by consumers on replay.
 */
export interface DlqEnvelope<T = unknown> {
  pattern: string;
  data: T;
  dlq: {
    sourceTopic: string;
    partition: number;
    offset: string;
    attempts: number;
    failedAt: string;
    error: string;
  };
}
