# ── Worker image ─────────────────────────────────────────────────────────────
# Pulls jobs from Redis and runs Playwright automation against ARCA / SiRADIG.
# This image is platform-agnostic: it runs the same on Fly.io, on a self-hosted
# Linux box via `docker run`, or on any container platform (k8s, ECS, Compose).
# It needs only outbound network access to Redis and Postgres.
#
# Base image is the official Playwright image, pinned to the same Playwright
# version as package.json so Chromium is pre-baked. Bumping playwright in
# package.json requires bumping the tag here.

FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install dependencies first for layer caching. Prisma's postinstall hook runs
# `prisma generate`; we need the schema for that, so copy prisma/ before
# installing.
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Full install (prod + dev). `tsx` is in devDependencies; it's the runtime for
# the worker. Skipping --omit=dev would drop it.
RUN npm ci

# App source
COPY tsconfig.json ./
COPY src ./src
COPY worker ./worker

# Sanity check: regenerate Prisma client against the copied schema.
RUN npx prisma generate

ENV NODE_ENV=production

# `tsx` runs the TS entrypoint directly, honoring the tsconfig path aliases so
# `@/lib/...` imports resolve without a separate compile step.
CMD ["npx", "tsx", "worker/index.ts"]
