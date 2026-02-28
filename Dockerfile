# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Prisma files needed for postinstall (prisma generate)
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY package*.json ./

RUN npm ci --ignore-scripts && npx prisma generate

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────
FROM node:20-slim AS runner

# System deps for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libudev1 libgbm1 libxshmfence1 libatspi2.0-0 libgtk-3-0 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only production deps + prisma generate
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install dotenv && npx prisma generate

# Install Playwright browser
RUN npx playwright install chromium

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3000
CMD sh -c "npx prisma db push --accept-data-loss && npx next start -p ${PORT:-3000}"
