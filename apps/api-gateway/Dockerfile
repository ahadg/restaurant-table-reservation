# ------------------------------------------------------------------------------
# Stage 1: Build the application
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies needed for compilation
COPY package*.json ./
RUN npm ci

# Copy monorepo configuration and source code
COPY nest-cli.json tsconfig.json ./
COPY apps/api-gateway apps/api-gateway
COPY libs libs

# Compile the api-gateway project
RUN npm run build -- api-gateway

# ------------------------------------------------------------------------------
# Stage 2: Install production dependencies only
# ------------------------------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 3: Production runtime image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Copy root package.json to preserve ESM ("type": "module") module resolution
COPY --chown=node:node package.json ./

# Copy production node_modules
COPY --chown=node:node --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy compiled application bundle
COPY --chown=node:node --from=builder /usr/src/app/dist/apps/api-gateway ./dist/apps/api-gateway

# Copy canonical proto contracts loaded dynamically at runtime via process.cwd()
COPY --chown=node:node libs/common/src/proto ./libs/common/src/proto

# Copy OpenTelemetry bootstrap script if NODE_OPTIONS="--import ./observability/otel/instrumentation.mjs" is used
COPY --chown=node:node observability/otel ./observability/otel

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/apps/api-gateway/main.js"]

