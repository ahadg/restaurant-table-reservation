import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common';
import { lokiEnabled, lokiUrl, type LokiLoggerOptions } from './loki.options.js';

interface BufferedLine {
  /** Nanoseconds since epoch, as a string - what Loki's push API expects. */
  timestamp: string;
  line: string;
  level: string;
}

const nowNs = () => (BigInt(Date.now()) * 1_000_000n).toString();

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export interface LokiLoggerConfig extends LokiLoggerOptions, ConsoleLoggerOptions { }

/**
 * A Nest logger that keeps writing to stdout exactly as before, and additionally
 * ships the same lines to Loki's HTTP push API.
 *
 * Deliberately app-side rather than a Promtail/Alloy container: these services
 * run on the host via `npm run start:dev`, not in Docker, so nothing scraping
 * Docker logs would ever see them.
 *
 * Only `service` and `level` become Loki labels. Anything else (request ids,
 * user ids) belongs in the log line - putting them in labels is what blows up
 * Loki's index cardinality.
 */
export class LokiLogger extends ConsoleLogger {
  private readonly service: string;
  private readonly pushUrl: string;
  private readonly enabled: boolean;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;

  private buffer: BufferedLine[] = [];
  private timer?: NodeJS.Timeout;
  private warned = false;

  constructor(config: LokiLoggerConfig) {
    super(config);
    this.service = config.service;
    this.pushUrl = `${lokiUrl(config.url)}/loki/api/v1/push`;
    this.enabled = lokiEnabled(config.enabled);
    this.batchSize = config.batchSize ?? 50;
    this.flushIntervalMs = config.flushIntervalMs ?? 2000;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message, ...optionalParams);
    this.enqueue('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.enqueue('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
    this.enqueue('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message, ...optionalParams);
    this.enqueue('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message, ...optionalParams);
    this.enqueue('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message, ...optionalParams);
    this.enqueue('fatal', message, optionalParams);
  }

  /** Overrides the level filter; forwarded so Nest's setLogLevels still works. */
  setLogLevels(levels: LogLevel[]): void {
    super.setLogLevels?.(levels);
  }

  private enqueue(level: string, message: unknown, optionalParams: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    const line = [message, ...optionalParams].map(toText).filter(Boolean).join(' ');
    if (!line) {
      return;
    }
    this.buffer.push({ timestamp: nowNs(), line, level });

    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.buffer.length === 0) {
      return;
    }

    const entries = this.buffer;
    this.buffer = [];

    // One stream per level keeps the label set small.
    const byLevel = new Map<string, [string, string][]>();
    for (const entry of entries) {
      const values = byLevel.get(entry.level) ?? [];
      values.push([entry.timestamp, entry.line]);
      byLevel.set(entry.level, values);
    }

    const streams = [...byLevel].map(([level, values]) => ({
      stream: { service: this.service, level },
      values,
    }));

    try {
      const response = await fetch(this.pushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error(`Loki responded ${response.status}`);
      }
    } catch (error) {
      // Never let observability break the app: stdout already has the line.
      if (!this.warned) {
        this.warned = true;
        process.stderr.write(
          `[LokiLogger] cannot ship logs to ${this.pushUrl} (${error instanceof Error ? error.message : String(error)
          }); logs continue on stdout\n`,
        );
      }
    }
  }
}
