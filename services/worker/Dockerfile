# Prefer building from the repo root (#43):
#   docker build --target worker -t abolkit-worker .
# The root Dockerfile worker target also installs Liblouis (python3-louis,
# liblouis-data) for optional Amharic BRF export (#55). This file stays for
# discoverability and local ffmpeg smoke builds.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-bookworm-slim

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

WORKDIR /app
RUN ffmpeg -version | head -n 1

# Compose starts the job loop via the root multi-stage `worker` target.
CMD ["ffmpeg", "-version"]
