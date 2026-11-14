#!/usr/bin/env bash
# Generate synthetic fixtures and run every recipe. Intended to run inside the
# worker Docker image (ffmpeg present). No demo clip or MMS service required.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RECIPES="$ROOT/recipes"
OUT="$ROOT/out"
FIX="$OUT/fixtures"

mkdir -p "$FIX"
rm -rf "$OUT"/lesson.* "$OUT"/ad-* "$OUT"/sizes.txt 2>/dev/null || true
mkdir -p "$OUT"

need_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg not found. Run via worker image, e.g.:" >&2
    echo "  docker build -t abolkit-worker -f services/worker/Dockerfile services/worker" >&2
    echo "  docker run --rm -v \"\$PWD/spikes/09-ffmpeg:/spike\" -w /spike abolkit-worker ./smoke.sh" >&2
    exit 1
  fi
  # Avoid SIGPIPE under pipefail when head closes early.
  ffmpeg -version 2>&1 | awk 'NR==1 { print; exit }'
}

need_ffmpeg

echo "== fixtures =="
# 8 s 360p lesson stand-in (tone + colour bars). Rights-free lavfi only.
ffmpeg -hide_banner -y \
  -f lavfi -i "color=c=0x1a4d6e:s=640x360:d=8:r=25" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=8" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest \
  "$FIX/lesson-src.mp4"

# Two short AD beeps (different pitch so ducking is audible in the mix).
ffmpeg -hide_banner -y -f lavfi -i "sine=frequency=880:sample_rate=48000:duration=1.2" \
  -c:a libopus -b:a 24k "$FIX/ad-001.opus"
ffmpeg -hide_banner -y -f lavfi -i "sine=frequency=660:sample_rate=48000:duration=1.0" \
  -c:a libopus -b:a 24k "$FIX/ad-002.opus"

echo "== recipes =="
bash "$RECIPES/extract-16k-mono.sh" "$FIX/lesson-src.mp4" "$OUT/lesson-16k.mp3"
bash "$RECIPES/opus-24k.sh" "$FIX/lesson-src.mp4" "$OUT/lesson.opus"
bash "$RECIPES/video-240p.sh" "$FIX/lesson-src.mp4" "$OUT/lesson-240p.mp4"
bash "$RECIPES/ad-mix-duck.sh" "$OUT/lesson-16k.mp3" "$OUT/lesson-with-ad.opus" \
  "2.0:$FIX/ad-001.opus" \
  "5.0:$FIX/ad-002.opus"

echo "== probe =="
{
  echo "file bytes"
  for f in "$OUT/lesson-16k.mp3" "$OUT/lesson.opus" "$OUT/lesson-240p.mp4" "$OUT/lesson-with-ad.opus"; do
    printf "%s %s\n" "$(basename "$f")" "$(wc -c < "$f" | tr -d ' ')"
  done
} | tee "$OUT/sizes.txt"

ffprobe -hide_banner -v error -select_streams a:0 \
  -show_entries stream=sample_rate,channels,codec_name \
  -of default=nw=1 "$OUT/lesson-16k.mp3" | tee "$OUT/probe-16k.txt"

# Expect 16000 / 1 / mp3
grep -q "sample_rate=16000" "$OUT/probe-16k.txt"
grep -q "channels=1" "$OUT/probe-16k.txt"
grep -q "codec_name=mp3" "$OUT/probe-16k.txt"

ffprobe -hide_banner -v error -select_streams v:0 \
  -show_entries stream=height,codec_name \
  -of default=nw=1 "$OUT/lesson-240p.mp4" | tee "$OUT/probe-240p.txt"
grep -q "height=240" "$OUT/probe-240p.txt"

ffprobe -hide_banner -v error -select_streams a:0 \
  -show_entries stream=codec_name \
  -of default=nw=1 "$OUT/lesson.opus" | tee "$OUT/probe-opus.txt"
grep -q "codec_name=opus" "$OUT/probe-opus.txt"

echo "OK: all recipes produced expected media"
