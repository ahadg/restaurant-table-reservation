# Repository guidance

## Project shape

- This is a NestJS 12 ESM monorepo. Read [docs/CONTEXT.md](docs/CONTEXT.md) before making architectural changes.
- Canonical gRPC contracts live in `libs/common/src/proto/`; update clients and servers together when changing an RPC.
- Reservation events are written to the PostgreSQL outbox in the same transaction as reservation changes, then published asynchronously to Kafka. Keep consumers idempotent.
- Redis is shared infrastructure for rate-limit counters, idempotency, and DLQ replay state. Kafka retry/DLQ behavior is in `libs/kafka/`; operating guidance is in `docs/DLQ_OPERATIONS.md`.
- OpenTelemetry, Prometheus, Grafana, Tempo, and Loki configuration lives under `observability/`. See `docs/OBSERVABILITY_OPERATIONS.md`.

## Conventions

- Use ESM imports with `.js` extensions and existing `@app/*` aliases.
- Follow the existing Nest module/controller/service patterns; keep transport contracts and DTO validation aligned.
- Never commit `.env`, credentials, tokens, or production data. `.env.example` contains placeholders only.
- Avoid high-cardinality or sensitive identifiers (user IDs, emails, raw URLs) in metric labels.
- Keep docs in sync when changing ports, environment variables, service boundaries, or operational behavior.

## Verification

- Install dependencies with `npm ci`.
- Run `npm run lint`, `npm test`, and `npm run build -- <project>` for affected projects. Project names are listed in `nest-cli.json`.
- Infrastructure-dependent checks may require `docker compose up -d` and `npm run db:push`; do not assume Docker services are running.
- Before changing database schema, messaging semantics, or auth behavior, inspect existing schema and relevant tests.
