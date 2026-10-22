# Observability operations

## Start and access the local stack

Start infrastructure containers:

```bash
docker compose up -d
```

Start the NestJS services from the repository root with `npm run start:dev`. The dev scripts preload `observability/otel/instrumentation.mjs`, which sends OTLP metrics and traces to the collector. Application logs are sent to Loki.

| UI/API | Local URL | Use |
| --- | --- | --- |
| Grafana | <http://localhost:3005> | Dashboards, Explore, and alerting UI |
| Prometheus | <http://localhost:9090> | Query metrics and inspect alert state |
| Loki | <http://localhost:3100> | Log API; normally query through Grafana Explore |
| OTLP HTTP | `http://localhost:4318` | Service telemetry ingestion endpoint |

Grafana is provisioned with Prometheus, Loki, and Tempo data sources and dashboards. Open **Kafka and DLQ Operations**, **Service Health Overview**, and **OpenTelemetry Signals Overview**. Traces are queried from Grafana Explore or the OpenTelemetry Signals Overview dashboard using Tempo.

## Signal flow

- **Metrics:** Node.js OpenTelemetry SDK → OTLP collector → Prometheus scrape at `otel-collector:8889` → Grafana.
- **Traces:** Node.js OpenTelemetry SDK → OTLP collector → Tempo → Grafana Tempo datasource.
- **Logs:** Nest application logger → Loki → Grafana Loki datasource. Trace IDs are embedded in log entries for correlation.

The telemetry is application/process-level, not host CPU or Docker-container resource monitoring. Tempo currently retains traces for 24 hours. No span-metrics/service-graph pipeline is configured, so trace-derived RED metrics and service-map edges may not be available.

## Troubleshooting

1. Check `docker compose ps` and `docker compose logs otel-collector tempo prometheus grafana loki`.
2. In Prometheus, open **Status → Targets** and confirm the `otel-collector` target is `UP`.
3. Confirm services were started with `npm run start:dev`, or have `NODE_OPTIONS=--import ./observability/otel/instrumentation.mjs` and an OTLP endpoint pointing to `http://localhost:4318`.
4. Generate traffic after starting services; dashboards have no app samples until telemetry is emitted and scraped. Widen the Grafana time range if needed.
5. For missing traces, verify OTLP receiver logs and Tempo health, then search recent traces in Grafana Explore with the Tempo datasource.
6. For missing logs, check `LOKI_ENABLED`, `LOKI_URL`, and Loki logs. The default local Loki endpoint is `http://localhost:3100`.
7. DLQ alert rules and response steps are in [DLQ_OPERATIONS.md](DLQ_OPERATIONS.md). Prometheus shows alert state at <http://localhost:9090/alerts>; outbound notifications require a Grafana contact point and notification policy.

## Safe operational guidance

- Do not use raw URLs, reservation IDs, user IDs, emails, or other unbounded/private values as Prometheus labels.
- Treat dashboards as diagnostic tools, not as a substitute for load-test reports or production SLOs.
- Before exposing Grafana or telemetry endpoints outside localhost, configure authentication, TLS, and network restrictions; compose defaults are for local development.
