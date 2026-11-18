# ------------------------------------------------------------------------------
# Stage 1: Build the application
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies needed for compilation
COPY package*.json .npmrc* ./
RUN npm ci

# Copy monorepo configuration and source code
COPY nest-cli.json tsconfig.json ./
COPY apps/reservation-service apps/reservation-service
COPY libs libs

# Compile the reservation-service project
RUN npm run build -- reservation-service

# ------------------------------------------------------------------------------
# Stage 2: Install production dependencies only
# ------------------------------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

COPY package*.json .npmrc* ./
RUN npm ci --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 3: Production runtime image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=50053

# Copy root package.json to preserve ESM ("type": "module") module resolution
COPY --chown=node:node package.json ./

# Copy production node_modules
COPY --chown=node:node --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy compiled application bundle
COPY --chown=node:node --from=builder /usr/src/app/dist/apps/reservation-service ./dist/apps/reservation-service

# Copy canonical proto contracts loaded dynamically at runtime via process.cwd()
COPY --chown=node:node libs/common/src/proto ./libs/common/src/proto

# Copy OpenTelemetry bootstrap script if NODE_OPTIONS="--import ./observability/otel/instrumentation.mjs" is used
COPY --chown=node:node observability/otel ./observability/otel

# Run as non-root user
USER node

# Reservation service exposes gRPC on port 50053
EXPOSE 50053

CMD ["node", "dist/apps/reservation-service/main.js"]
