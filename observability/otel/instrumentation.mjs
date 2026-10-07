// OpenTelemetry bootstrap for every service.
//
// Loaded through NODE_OPTIONS="--import ..." so it runs BEFORE the application
// bundle. This has to stay plain JS outside the TypeScript build: auto
// instrumentation patches modules as they are loaded, so it must be in place
// first. It works here because rspack treats node_modules as *external* - the
// app imports them at runtime, so the patching still applies.
//
// Everything is driven by env, so no per-service code is needed:
//   OTEL_EXPORTER_OTLP_ENDPOINT  default http://localhost:4318 (the collector)
//   OTEL_SERVICE_NAME            default derived from the bundle path
//   OTEL_SDK_DISABLED=true       turn tracing/metrics off entirely
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

function resolveServiceName() {
  if (process.env.OTEL_SERVICE_NAME) {
    return { name: process.env.OTEL_SERVICE_NAME, source: 'OTEL_SERVICE_NAME' };
  }
  // Nest runs the app as `node dist/apps/<name>/main` - no extension, and no
  // trailing slash after the name, so match the segment after 'apps' loosely.
  const entry = process.argv[1] ?? '';
  const match = entry.match(/dist[\\/]apps[\\/]([^\\/]+)/);
  if (match) {
    return { name: match[1], source: 'bundle path' };
  }
  return { name: 'unknown-service', source: `unresolved (argv[1]=${entry || 'none'})` };
}

function start() {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }

  const endpoint = (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
  ).replace(/\/+$/, '');

  const { name, source } = resolveServiceName();

  // The SDK builds its default resource from env, so setting this before the SDK
  // is constructed is enough to get service.name on every span and metric.
  process.env.OTEL_SERVICE_NAME = name;

  // Always say what was resolved: a wrong service.name is otherwise only visible
  // as a mystery label in Tempo.
  process.stderr.write(`[otel] service.name="${name}" (from ${source}) -> ${endpoint}\n`);
  if (name === 'unknown-service') {
    process.stderr.write(
      '[otel] could not derive the service name; set OTEL_SERVICE_NAME to fix the label in Tempo.\n',
    );
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 10_000,
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Very chatty and not useful here.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // No signal handlers on purpose: registering one would suppress Node's default
  // termination and can make Ctrl-C / concurrently shutdown hang. The cost is
  // that the final in-flight batch (<=10s of metrics) is lost on a hard stop.
  process.on('exit', () => {
    void sdk.shutdown().catch(() => { });
  });
}

start();
