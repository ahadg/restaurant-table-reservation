import {
  context,
  isSpanContextValid,
  propagation,
  trace,
  type Context,
  type TextMapGetter,
  type TextMapSetter,
} from '@opentelemetry/api';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

const TRACE_ENVELOPE = '__restaurant_otel_tcp_envelope_v1__';

interface TcpTraceEnvelope {
  [TRACE_ENVELOPE]: true;
  headers: Record<string, string>;
  payload: unknown;
}

const setter: TextMapSetter<Record<string, string>> = {
  set(carrier, key, value) {
    carrier[key] = value;
  },
};

const getter: TextMapGetter<Record<string, string>> = {
  keys: (carrier) => Object.keys(carrier),
  get: (carrier, key) => carrier[key.toLowerCase()],
};

/** Wrap a Nest TCP request with W3C trace headers; the receiving interceptor unwraps it. */
export function withTcpTrace<T>(payload: T): T | TcpTraceEnvelope {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  // Don't add a wrapper or allocate a carrier if this work has no active trace.
  if (!spanContext || !isSpanContextValid(spanContext)) return payload;

  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers, setter);
  return { [TRACE_ENVELOPE]: true, headers, payload };
}

/** Restore the gateway's trace context around a TCP message handler. */
@Injectable()
export class TcpTracePropagationInterceptor implements NestInterceptor {
  intercept(execution: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (execution.getType() !== 'rpc') return next.handle();

    const args = execution.getArgs<unknown[]>();
    const envelope = args[0] as Partial<TcpTraceEnvelope> | undefined;
    if (!envelope || envelope[TRACE_ENVELOPE] !== true || !envelope.headers || !('payload' in envelope)) {
      return next.handle();
    }

    // Keep the existing controller signatures/data contracts transparent to handlers.
    args[0] = envelope.payload;
    const parentContext: Context = propagation.extract(context.active(), envelope.headers, getter);

    // RxJS may defer handler execution until subscription; subscribe within the
    // extracted context so async work and logs inherit the originating trace.
    return new Observable((subscriber) =>
      context.with(parentContext, () => next.handle().subscribe(subscriber)),
    );
  }
}
