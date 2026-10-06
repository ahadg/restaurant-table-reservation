import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';

type RequestWithId = Request & { requestId?: string };

/**
 * ThrottlerGuard that logs every rejection.
 *
 * Nest's default exception filter does not log 4xx responses, so without this a
 * throttled client is completely invisible - you would see 429s in a client but
 * nothing in the server logs.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  // Own logger so the lines are attributed to this guard rather than the parent.
  private readonly rateLimitLogger = new Logger(RateLimitGuard.name);

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId = request.requestId ? ` requestId=${request.requestId}` : '';
    this.rateLimitLogger.warn(
      `429 ${request.method} ${request.originalUrl.split('?')[0]} ip=${request.ip} ` +
        `hits=${detail.totalHits}/${detail.limit} retryAfter=${detail.timeToBlockExpire}s${requestId}`,
    );
    return super.throwThrottlingException(context, detail);
  }
}
