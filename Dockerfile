# API and worker images for docker-compose.yml (ADR 0007). Build one with --target api|worker.
# Both run the TypeScript sources directly (Node type stripping), like `pnpm dev`, so there is no build step.

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV CI=true
RUN npm install --global pnpm@11.28.9 && npm cache clean --force
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter "@abolkit/api..." --filter "@abolkit/worker..."

FROM base AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
COPY --from=deps /app /app
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/services/api
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/index.ts"]

FROM base AS worker
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe
RUN ffmpeg -version | head -n 1
# Optional Amharic Braille export (#55): Liblouis + ethio-g1.ctb via python3-louis.
# Offline-pack Braille stays off unless job params set includeBraille=true.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-louis liblouis-data \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -c "import louis; print(louis.version())"
ENV NODE_ENV=production
ENV FFMPEG_BIN=/usr/local/bin/ffmpeg
CMD ["pnpm", "--filter", "@abolkit/worker", "start"]

FROM base AS worker
ARG YTDLP_VERSION=2026.10.26
ENV NODE_ENV=production
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
# Standalone yt-dlp build; it uses Node (already here) as its JavaScript runtime for YouTube.
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux /usr/local/bin/yt-dlp
RUN ffmpeg -version | head -n 1 && yt-dlp --version
COPY --from=deps /app /app
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/services/worker
CMD ["node", "src/index.ts"]
