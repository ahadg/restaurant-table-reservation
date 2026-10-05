import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA = '__idempotent__';

export interface IdempotentOptions {
  /**
   * When true, the request is rejected with 400 if no `Idempotency-Key` header
   * is sent. Defaults to false so the endpoint keeps working for existing
   * clients while they adopt the header.
   */
  required?: boolean;
  /** How long a stored response stays replayable. Defaults to 24 hours. */
  ttlMs?: number;
}

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Marks a route as idempotent.
 *
 * When the client sends `Idempotency-Key: <unique-value>`, the first request is
 * executed and its response is stored; any retry with the same key (same user,
 * method and path) replays that stored response instead of running the handler
 * again.
 *
 *   @Idempotent()                       // honoured when the header is present
 *   @Idempotent({ required: true })     // 400 when the header is missing
 */
export const Idempotent = (options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_METADATA, {
    required: options.required ?? false,
    ttlMs: options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
  } satisfies Required<IdempotentOptions>);
