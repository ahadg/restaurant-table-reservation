# Restaurant Table Reservation — Project Context

NestJS 12 ESM monorepo for restaurant table reservations. An HTTP API gateway fronts auth (TCP microservice) and restaurant (gRPC microservice). Shared libraries live under `libs/`. Table reservation itself is named in constants but not implemented yet.

## Architecture

```mermaid
flowchart LR
  Client --> GW["api-gateway :3000 HTTP"]
  GW -->|"TCP MessagePattern"| AUTH["auth-service :3001"]
  GW -->|"gRPC restaurant.RestaurantService"| REST["restaurant-service :50051"]
  AUTH --> PG[(PostgreSQL)]
  REST --> PG
```

| App | Role | Transport | Default port |
| --- | --- | --- | --- |
| `apps/api-gateway` | HTTP entry, JWT on protected routes, client proxy | HTTP + TCP client + gRPC client | `3000` |
| `apps/auth-service` | Register, login, JWT issue/verify, profile | TCP microservice | `3001` |
| `apps/restaurant-service` | Restaurant CRUD, location, hours, house rules | gRPC microservice | `50051` |

| Library | Import alias | Purpose |
| --- | --- | --- |
| `libs/common` | `@app/common` | Service names/ports, DTOs, JWT strategy/guard, proto |
| `libs/database` | `@app/database` | Drizzle + `pg` pool, schema |
| `libs/kafka` | `@app/kafka` | Stub only (`KafkaService` is empty) |

`SERVICES.RESERVATION_SERVICE` / port `3002` is reserved in `libs/common/src/constants/services.constants.ts`; there is no app yet.

## How to run

Postgres via `docker-compose.yml` (`restaurant` / `restaurant_password` / `restaurant_db` on `5432`).

```bash
npm install
docker compose up -d
npm run db:push          # drizzle-kit push
# three processes:
nest start auth-service --watch
nest start restaurant-service --watch
nest start api-gateway --watch   # or npm run start:dev
```

Env:

| Variable | Used by | Default |
| --- | --- | --- |
| `DATABASE_URL` | `DatabaseService`, drizzle-kit | `postgresql://restaurant:restaurant_password@localhost:5432/restaurant_db` |
| `JWT_SECRET` | gateway + auth JWT | `secretKey` |
| `PORT` | each process | service default port |
| `AUTH_SERVICE_HOST` / `AUTH_SERVICE_PORT` | gateway TCP client | `127.0.0.1:3001` |
| `RESTAURANT_SERVICE_URL` | gateway gRPC client | `127.0.0.1:50051` |

Scripts: `build` (Nest + rspack), `test` (vitest), `lint` (oxlint; script path still says `src/ test/` and may not match the monorepo layout), `db:generate` / `db:push`.

## Gateway HTTP API

Global `ValidationPipe` (`whitelist`, `transform`). JWT: `Authorization: Bearer <token>`. Guard: `JwtAuthGuard`. User on request: `{ userId, email, role }` from `JwtStrategy.validate`.

| Method | Path | Auth | Downstream |
| --- | --- | --- | --- |
| GET | `/` | no | local hello |
| GET | `/ping` | no | local health |
| POST | `/auth/register` | no | TCP `{ cmd: 'register' }` |
| POST | `/auth/login` | no | TCP `{ cmd: 'login' }` |
| GET | `/auth/profile` | JWT | TCP `{ cmd: 'get_profile' }` `{ userId }` |
| POST | `/auth/validate` | JWT | local `{ valid, user }` |
| POST | `/restaurants` | JWT | gRPC `CreateRestaurant` (`ownerId` from JWT) |
| GET | `/restaurants?page&limit` | no | gRPC `ListRestaurants` |
| GET | `/restaurants/:id` | no | gRPC `GetRestaurant` |
| PUT | `/restaurants/:id` | JWT | gRPC `UpdateRestaurant` |
| DELETE | `/restaurants/:id` | JWT | gRPC `DeleteRestaurant` |
| POST | `/restaurants/:id/location` | JWT | gRPC `AddLocation` |
| POST | `/restaurants/:id/opening-hours` | JWT | gRPC `SetOpeningHours` |
| POST | `/restaurants/:id/house-rules` | JWT | gRPC `AddHouseRule` |

Auth TCP patterns also include `health_check` and `validate_token`; the gateway does not expose those as HTTP.

Register body: `name`, `email`, `password` (min 6), optional `role` `USER` \| `ADMIN`. Login: `email`, `password`.

## Auth service

`AuthServiceService` uses Drizzle on `users`. Passwords: `bcryptjs` cost 10. JWT payload: `{ sub, email, role }`, expiry `1d`. Duplicate email → RPC 409. Bad login → 401. Missing profile → 404.

## Restaurant service

Proto: **canonical copy** `libs/common/src/proto/restaurant.proto` (package `restaurant`, service `RestaurantService`). Gateway and restaurant-service both load that path via `process.cwd()`. A duplicate exists at `apps/restaurant-service/src/proto/restaurant.proto` — keep them in sync or delete the app copy.

gRPC methods map 1:1 to `RestaurantServiceController` `@GrpcMethod` handlers.

`SetOpeningHours` deletes existing hours for the restaurant, then inserts the new list. `dayOfWeek`: `0` Sunday … `6` Saturday. Times are strings like `"09:00"`.

## Data model (Drizzle, PostgreSQL)

Schema: `libs/database/src/schema/`. Both auth and restaurant services import the **same** `DatabaseModule` and `DATABASE_URL` today. Schema comments intend no FK from restaurants to users (owner is a plain UUID). Child restaurant tables still FK to `restaurants` with `onDelete: cascade`.

**users** (`role` enum `USER` \| `ADMIN`): `id`, `name`, `email` (unique), `password`, `role`, `isActive`, `emailVerifiedAt`, `lastLoginAt`, `createdAt`, `updatedAt`, `deletedAt`.

**restaurants**: `id`, `name`, `description`, `phone`, `email`, `cuisine`, `isActive`, `ownerId` (no FK), timestamps.

**locations**, **opening_hours**, **house_rules**: all `restaurant_id` → `restaurants.id`.

`DatabaseService` is a Nest provider wrapping `pg.Pool` + `drizzle(..., { schema })`.

## Conventions

- TypeScript **strict**, `"type": "module"`, `module`/`moduleResolution` `nodenext`. Local imports use `.js` extensions.
- Path aliases only for `@app/common`, `@app/database`, `@app/kafka`.
- Nest monorepo: `nest-cli.json` root project is `api-gateway`; builder **rspack**; proto files copied as assets.
- Shared JWT secret between gateway Passport strategy and auth `JwtModule`.
- Do not put restaurant FKs onto `users`. Prefer service-owned data; if splitting DBs later, split schema usage accordingly.
- Kafka is unused; do not assume events exist.

## Gaps / watchouts

- No reservation, table, or booking entities yet.
- Gateway restaurant mutations are JWT-protected but do **not** check owner/admin vs `ownerId`.
- `listRestaurants` N+1 queries location/hours/rules per row.
- `tsconfig.json` still references `apps/restaurant-table-reservation` which is not a current app.
- `npm run start:prod` points at `dist/apps/restaurant-table-reservation/main`.
- `restaurant.proto` is duplicated under the restaurant-service app.
