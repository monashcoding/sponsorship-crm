# Multi-stage build for the MAC Sponsorship CRM (Node 22, ESM, TypeScript).
# One image serves both the API and the built SPA. Builds on any arch, including the
# Oracle Cloud ARM (aarch64) target. Mirrors mac-auth's Dockerfile conventions.

# ---- build the SPA ----------------------------------------------------------
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- build the server -------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
# Compile TS -> dist. Migrations are COMMITTED under ./drizzle and are NOT generated
# here: regenerating at build time gives fresh migration timestamps, which makes the
# migrator re-run already-applied migrations against the live DB and crash.
RUN npm run build:server

# ---- runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Compiled server, committed SQL migrations, and the built SPA.
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY --from=web /app/web/dist ./web/dist
EXPOSE 3000
# Apply pending migrations (incl. pg_trgm), then start the server.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
