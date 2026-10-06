export const DEFAULT_LOKI_URL = 'http://localhost:3100';

export interface LokiLoggerOptions {
  /** Low-cardinality label identifying the process, e.g. 'api-gateway'. */
  service: string;
  /** Loki base URL. Defaults to LOKI_URL, then http://localhost:3100. */
  url?: string;
  /** Set false (or LOKI_ENABLED=false) to keep logs on stdout only. */
  enabled?: boolean;
  /** Flush once this many lines are buffered. Defaults to 50. */
  batchSize?: number;
  /** Flush at least this often. Defaults to 2000ms. */
  flushIntervalMs?: number;
}

export function lokiUrl(override?: string): string {
  return (override || process.env.LOKI_URL || DEFAULT_LOKI_URL).replace(/\/+$/, '');
}

export function lokiEnabled(override?: boolean): boolean {
  if (override !== undefined) {
    return override;
  }
  // Enabled by default so `docker compose up -d` works with no extra config;
  // set LOKI_ENABLED=false to opt out.
  return process.env.LOKI_ENABLED !== 'false';
}
