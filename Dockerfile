FROM oven/bun:1 AS base
WORKDIR /app

# Install Chromium system dependencies
RUN set -eux; \
    sed -i 's|http://|https://|g' /etc/apt/sources.list 2>/dev/null || true; \
    sed -i 's|http://|https://|g' /etc/apt/sources.list.d/*.sources 2>/dev/null || true; \
    if [ ! -s /etc/ssl/certs/ca-certificates.crt ]; then \
      echo 'Acquire::https::Verify-Peer "false";' > /etc/apt/apt.conf.d/99tmp-noverify; \
    fi; \
    echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates; \
    rm -f /etc/apt/apt.conf.d/99tmp-noverify; \
    apt-get update && apt-get install -y --no-install-recommends \
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
