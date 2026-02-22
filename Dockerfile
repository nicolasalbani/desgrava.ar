FROM node:20-slim

# System deps for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libudev1 libgbm1 libxshmfence1 libatspi2.0-0 libgtk-3-0 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy prisma files first so postinstall (prisma generate) works during npm ci
COPY prisma ./prisma/
COPY prisma.config.ts ./

COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
