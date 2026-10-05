import type { RedisOptions } from 'ioredis';

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export function redisUrl(): string {
  return process.env.REDIS_URL || DEFAULT_REDIS_URL;
}

export function createRedisOptions(): RedisOptions {
  return {
    // Fail fast instead of buffering commands while Redis is unreachable, so a
    // Redis outage surfaces immediately to the caller that decides how to react.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  };
}
