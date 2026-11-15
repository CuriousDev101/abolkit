# Abol Kit Compose images (#43): api + worker.
# Build: docker build --target api -t abolkit-api .
#        docker build --target worker -t abolkit-worker .

FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Avoid writing a host-relative store path from .npmrc into the image.
ENV PNPM_STORE_DIR=/pnpm/store
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY services ./services
COPY samples ./samples
COPY scripts ./scripts

# Drop host-relative store-dir from .npmrc so installs use PNPM_STORE_DIR in-image.
RUN sed -i '/^store-dir=/d' .npmrc

# Install only the API/worker dependency graphs (and their workspace packages).
RUN pnpm install --frozen-lockfile --filter @abolkit/api... --filter @abolkit/worker...

FROM base AS api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@abolkit/api", "start"]

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

FROM base AS seed
ENV NODE_ENV=production
CMD ["node", "--experimental-strip-types", "services/api/scripts/seed-demo.ts"]
