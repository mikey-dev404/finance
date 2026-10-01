# Finance headless API + Safari UI (port 18765)
# Install on Windows at S:/docker/finance — see docs/DOCKER.md

FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
# Skip electron-builder postinstall; rebuild better-sqlite3 for Node in the container.
RUN npm ci --ignore-scripts \
  && npm rebuild better-sqlite3

COPY . .
RUN npm run phone:build \
  && npm run server:build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
  FINANCE_DATA_DIR=/data \
  FINANCE_WEB_DIR=/app/phone \
  FINANCE_PHONE_PORT=18765

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && npm cache clean --force \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/out/server /app/out/server
COPY --from=build /app/mobile/www /app/phone
COPY scripts/show-tokens.cjs /app/scripts/show-tokens.cjs

RUN mkdir -p /data

EXPOSE 18765

VOLUME ["/data"]

CMD ["node", "out/server/headless.js"]
