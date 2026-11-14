#!/usr/bin/env bash
# Low-bitrate Opus for offline pack / audio-only playback (~24 kbps mono).
# Usage: opus-24k.sh <input-video-or-audio> <output.opus>
set -euo pipefail

IN="${1:?input media path required}"
OUT="${2:?output .opus path required}"

# Opus is typically 48 kHz; mono speech at 24k is the offline-pack target.
ffmpeg -hide_banner -y -i "$IN" \
  -vn \
  -ac 1 \
  -ar 48000 \
  -c:a libopus \
  -b:a 24k \
  -vbr on \
  -compression_level 10 \
  -application voip \
  "$OUT"

echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
