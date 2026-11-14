#!/usr/bin/env bash
# 240p H.264 rendition (optional offline / low-bandwidth video).
# Usage: video-240p.sh <input-video> <output.mp4>
set -euo pipefail

IN="${1:?input video path required}"
OUT="${2:?output .mp4 path required}"

# Scale height to 240, keep even width. Light AAC for player compatibility;
# preferred audio-only path remains opus-24k.sh.
ffmpeg -hide_banner -y -i "$IN" \
  -vf "scale=-2:240" \
  -c:v libx264 \
  -preset medium \
  -crf 28 \
  -profile:v baseline \
  -level 3.0 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac \
  -b:a 64k \
  -ac 1 \
  -ar 44100 \
  "$OUT"

echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
