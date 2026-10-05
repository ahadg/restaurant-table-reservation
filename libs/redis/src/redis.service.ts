import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createRedisOptions, redisUrl } from './redis.options.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** The underlying client, for anything not covered by the helpers below. */
  readonly client: Redis;

  constructor() {
    const url = redisUrl();
    this.client = new Redis(url, createRedisOptions());

    this.client.on('error', (error: Error & { code?: string; errors?: Error[] }) => {
      // ioredis reports connection failures as an AggregateError with an empty
      // message, so fall back to the code / individual errors for a usable log.
      const detail =
        error?.message ||
        error?.code ||
        error?.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        String(error);
      this.logger.error(`Redis error: ${detail}`);
    });
    this.client.on('connect', () => {
      this.logger.log(`Redis connected (${url})`);
    });
  }

  /**
   * `SET key value NX PX <ttl>` — the atomic claim primitive. Returns true only
   * for the caller that created the key; false means it already existed.
   */
  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Overwrites the value and refreshes the TTL. */
  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.client.set(key, value, 'PX', ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Remaining TTL in milliseconds (-1 no expiry, -2 missing). */
  ttl(key: string): Promise<number> {
    return this.client.pttl(key);
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
