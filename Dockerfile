FROM oven/bun:1 AS base
WORKDIR /app

# Install Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Install Chromium browser binary
RUN ./node_modules/.bin/playwright install chromium

# Final image
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /root/.cache/ms-playwright /root/.cache/ms-playwright
COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
