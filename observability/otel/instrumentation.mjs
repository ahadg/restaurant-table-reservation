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
    return process.env.OTEL_SERVICE_NAME;
  }
  // Nest builds each app to dist/apps/<name>/main.js, so the name is right there.
  const match = (process.argv[1] ?? '').match(/dist[\\/]apps[\\/]([^\\/]+)[\\/]/);
  return match ? match[1] : 'unknown-service';
}

function start() {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }

  const endpoint = (
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
  ).replace(/\/+$/, '');

  // The SDK builds its default resource from env, so setting this here is enough
  // to get service.name on every span and metric.
  process.env.OTEL_SERVICE_NAME = resolveServiceName();

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
