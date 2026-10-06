import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '@app/redis';

/**
 * `ThrottlerStorageRecord` is not re-exported from the package barrel, so derive
 * it from the public interface instead of deep-importing an internal path - this
 * keeps the shape correct across upgrades.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Redis-backed ThrottlerStorage, so limits are shared across gateway instances
 * and survive restarts instead of living in per-process memory.
 *
 * Mirrors the semantics of @nestjs/throttler's in-memory store:
 *  - ttl / blockDuration arrive in MILLISECONDS, the record reports SECONDS.
 *  - blockDuration <= 0 -> the request that exceeds `limit` is refused but no
 *    block is recorded.
 *  - blockDuration  > 0 -> exceeding `limit` sets a block key for that long.
 *
 * The whole check-and-increment runs as one Lua script so concurrent requests
 * cannot both read the same counter value.
 */
const SCRIPT = `
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or 0)
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then ttl = 0 end
  return { hits, ttl, 1, blockTtl }
end

if blockMs <= 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or 0)
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then ttl = 0 end
  if hits >= limit then
    return { hits + 1, ttl, 1, 0 }
  end
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then redis.call('PEXPIRE', KEYS[1], ttlMs) end
  ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then ttl = 0 end
  return { current, ttl, 0, 0 }
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ttlMs) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then ttl = 0 end
if hits > limit then
  redis.call('SET', KEYS[2], 1, 'PX', blockMs)
  return { hits, ttl, 1, blockMs }
end
return { hits, ttl, 0, 0 }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;

    try {
      const result = (await this.redis.client.eval(
        SCRIPT,
        2,
        hitsKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = result;
      return {
        totalHits: Number(totalHits),
        timeToExpire: Math.max(0, Math.ceil(Number(timeToExpireMs) / 1000)),
        isBlocked: Number(isBlocked) === 1,
        timeToBlockExpire: Math.max(0, Math.ceil(Number(timeToBlockExpireMs) / 1000)),
      };
    } catch (error) {
      // Fail open: a limiter outage must not become an API outage. The trade-off
      // is that traffic is unbounded while Redis is unreachable.
      this.logger.error(
        `Redis unavailable - rate limit NOT enforced for ${throttlerName}`,
        error as Error,
      );
      return { totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
