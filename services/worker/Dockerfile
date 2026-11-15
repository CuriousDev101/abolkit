# Prefer the repo-root Dockerfile (ADR 0007):
#   docker build --target worker -t abolkit-worker .
# Root worker installs ffmpeg, yt-dlp, and Liblouis (#55). This file is only
# for discoverability / local ffmpeg smoke builds.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-bookworm-slim

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

WORKDIR /app
RUN ffmpeg -version | head -n 1

# Compose starts the job loop via the root multi-stage `worker` target.
CMD ["ffmpeg", "-version"]
