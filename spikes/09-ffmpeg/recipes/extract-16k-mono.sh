#!/usr/bin/env bash
# Extract 16 kHz mono MP3 for STT (external MMS ASR wrapper).
# MP3 keeps intermediate storage small vs PCM WAV; MMS HTTP client accepts audio/mpeg.
# Usage: extract-16k-mono.sh <input-video-or-audio> <output.mp3>
set -euo pipefail

IN="${1:?input media path required}"
OUT="${2:?output .mp3 path required}"

# 32 kbps is enough for mono speech at 16 kHz and far smaller than PCM WAV.
ffmpeg -hide_banner -y -i "$IN" \
  -vn \
  -ac 1 \
  -ar 16000 \
  -c:a libmp3lame \
  -b:a 32k \
  "$OUT"

bytes="$(wc -c < "$OUT" | tr -d '[:space:]')"
echo "wrote $OUT (${bytes} bytes)"
