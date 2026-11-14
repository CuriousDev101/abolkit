# Worker image: Node + ffmpeg. STT/TTS models stay in separate services
# (e.g. MMS ASR via TRANSCRIBER_URL). Spike #9 recipes run here.
#
# Static ffmpeg keeps the image lean vs apt's ~200 media packages.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-bookworm-slim

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

WORKDIR /app

# Confirm ffmpeg is available at build time (fails the image if missing).
RUN ffmpeg -version | head -n 1

# Job runner lands in #25/#26. Until then this image is enough to run recipes.
CMD ["ffmpeg", "-version"]
