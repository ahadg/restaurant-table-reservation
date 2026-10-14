# Kafka DLQ operations

## What is available

- Consumers retry a failed event three times by default, with exponential delays.
- If all handler attempts fail, the event is written to `<source-topic>.dlq` with its payload, source partition/offset, failure time, attempt count, and error.
- The public page at `http://localhost:3000/admin/dead-letters` shows only synthetic events from `dlq.demo.dlq`; it does not expose real DLQs. Seed the demo with `npm run dlq:seed-demo`. Its Retry action republishes only to `dlq.demo`, which has no application consumer.
- The authenticated operator page at `http://localhost:3000/admin/dead-letters/manage` discovers DLQ topics and pages through retained messages (up to 500 per topic per page). It allows an administrator to edit event data and replay an individual event after confirmation. Live DLQ APIs require an ADMIN JWT. DLQ records remain in Kafka for audit.
- Replay status and an audit record are stored in Redis. Concurrent replay clicks for the same message are locked. Refreshing the page caches the listed message references in Redis for ten minutes before replay is allowed.
- Prometheus rules alert when messages reach a DLQ or when writing to a DLQ fails. See `http://localhost:9090/alerts`.

## Start the stack

Start infrastructure with `docker compose up -d`, then start the Nest services with `npm run start:dev`. In development, the existing `NODE_OPTIONS` instrumentation exports OpenTelemetry metrics to the collector, which Prometheus scrapes. The alerts are also visible in Prometheus; set up a Grafana contact point if they should notify a person through email, Slack, or another destination.

Apply the updated database schema before starting the services: `npm run db:push`. This adds the event ID columns and uniqueness constraints used to suppress duplicate effects during replay.

## Admin access

Public signup must not grant administrator privileges based on a request body. Set `ADMIN_EMAILS` to a comma-separated allowlist in the application environment before registering the intended operator account, for example `ADMIN_EMAILS=ops@example.com`. That account receives the ADMIN role; other signups receive USER even if they submit `role: ADMIN`. Then log in through `/auth/login`, copy the returned `accessToken`, and paste it into the live manager at `/admin/dead-letters/manage`. For an existing trusted account, assign its role through the database administrator process:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'ops@example.com';
```

Use a strong `JWT_SECRET` in any environment reachable by other people. The public demo intentionally requires no token because it reads only synthetic demo records. The live manager's data and replay APIs enforce a valid JWT with role ADMIN.

## Inspect, fix, replay

For live incidents, open `/admin/dead-letters/manage`, paste the administrator token, and load messages. Read the failure and inspect or correct the JSON payload. Fix the underlying consumer/data issue first, then use the per-message Retry button. The event is republished to its original topic with its original key and a replay marker. Refresh to see its replay status. Keep the original DLQ message as the audit trail. The public demo page is safe for previewing the workflow only; its Retry button targets the isolated demo topic.

If the DLQ publish itself fails, the interceptor now rethrows the failure so Kafka does not acknowledge the source record; that partition will retry it until the DLQ broker is available. This protects the only copy, but may pause progress on that partition during a sustained Kafka outage.

## Delivery semantics and limits

Kafka replay is at-least-once. A process can fail after publishing but before saving the Redis status, so a later retry can publish again. The notification and email-log consumers now use database uniqueness constraints on the reservation event ID, making those writes idempotent. Prometheus rules make alerts visible in the monitoring UI; outbound alert delivery requires configuring a Grafana contact point for the operator's chosen channel.
