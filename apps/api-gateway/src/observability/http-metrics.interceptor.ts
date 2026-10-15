import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { metrics, type Attributes } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Adds low-cardinality route metrics for the public HTTP API. Route templates
 * are recorded (for example `/reservations/:id`), never raw URLs, IDs, or queries.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly requests = metrics.getMeter('restaurant-http').createCounter('app_http_server_requests');
  private readonly duration = metrics.getMeter('restaurant-http').createHistogram(
    'app_http_server_request_duration_seconds',
    { unit: 's' },
  );

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();
    let recorded = false;

    const record = (statusCode: number) => {
      if (recorded) return;
      recorded = true;

      const routeTemplate = request.route?.path;
      // `route.path` is the router template, not the concrete path containing IDs.
      const route = typeof routeTemplate === 'string'
        ? `${request.baseUrl || ''}${routeTemplate}`
        : 'unmatched';
      const attributes: Attributes = {
        http_request_method: request.method,
        http_route: route,
        http_response_status_code: statusCode,
      };

      this.requests.add(1, attributes);
      this.duration.record((performance.now() - startedAt) / 1000, attributes);
    };

    return next.handle().pipe(tap({
      next: () => record(response.statusCode),
      error: (error: unknown) => record(error instanceof HttpException ? error.getStatus() : 500),
      complete: () => record(response.statusCode),
    }));
  }
}
