# Production images (EC2 / demo).
#   docker compose -f docker-compose.prod.yml up -d --build
#
# Local hot-reload: docker compose up --build  → Dockerfile.dev

ARG NODE_IMAGE=node:24-bookworm-slim
ARG YTDLP_VERSION=2026.10.26

FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM ${NODE_IMAGE} AS base
ENV CI=true
RUN npm install --global pnpm@11.28.9 && npm cache clean --force
WORKDIR /app

# Manifests first (better layer cache), then sources needed by api/worker.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.docker.yaml ./pnpm-workspace.yaml
COPY packages/core/package.json packages/core/
COPY packages/caption-store/package.json packages/caption-store/
COPY packages/jobs/package.json packages/jobs/
COPY packages/job-card/package.json packages/job-card/
COPY packages/provider-sdk/package.json packages/provider-sdk/
COPY services/api/package.json services/api/
COPY services/worker/package.json services/worker/
RUN pnpm install --frozen-lockfile --prod --filter "@abolkit/api..." --filter "@abolkit/worker..."

FROM deps AS source
COPY packages/core packages/core
COPY packages/caption-store packages/caption-store
COPY packages/jobs packages/jobs
COPY packages/job-card packages/job-card
COPY packages/provider-sdk packages/provider-sdk
COPY services/api services/api
COPY services/worker services/worker

FROM source AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/services/api
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "src/index.ts"]

FROM source AS worker
ARG YTDLP_VERSION
ENV NODE_ENV=production FFMPEG_BIN=/usr/local/bin/ffmpeg
USER root
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux /usr/local/bin/yt-dlp
# Liblouis: optional Amharic BRF export (#55). Harmless if unused.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-louis liblouis-data \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/services/worker
CMD ["node", "--experimental-strip-types", "src/index.ts"]
