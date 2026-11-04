FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY frontend/scripts frontend/scripts
RUN npm ci

COPY backend backend
RUN npm --workspace backend exec prisma generate \
  && npm --workspace backend run build \
  && chmod +x backend/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000
CMD ["backend/docker-entrypoint.sh"]
