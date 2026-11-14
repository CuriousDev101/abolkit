#!/usr/bin/env bash
# Mix timed AD clips onto main audio with ducking (sidechaincompress).
#
# Usage:
#   ad-mix-duck.sh <main-audio> <output.opus> <start_sec:clip> [start_sec:clip ...]
#
# Example (matches architecture AD clip timing style):
#   ad-mix-duck.sh lesson-16k.mp3 lesson-with-ad.opus 2.0:ad-001.opus 5.5:ad-002.opus
#
# Ducking: main drops when an AD clip is audible, then restores.
# Output is 24 kbps mono Opus for the offline pack audio-only AD track.
set -euo pipefail

MAIN="${1:?main audio path required}"
OUT="${2:?output .opus path required}"
shift 2

if [[ "$#" -lt 1 ]]; then
  echo "need at least one <start_sec:clip> argument" >&2
  exit 1
fi

INPUTS=(-i "$MAIN")
FILTERS=()
AD_LABELS=()
idx=1

for spec in "$@"; do
  start="${spec%%:*}"
  clip="${spec#*:}"
  if [[ -z "$start" || -z "$clip" || "$start" == "$clip" ]]; then
    echo "bad clip spec ${spec} (want start_sec:path)" >&2
    exit 1
  fi
  if [[ ! -f "$clip" ]]; then
    echo "AD clip not found: $clip" >&2
    exit 1
  fi

  # adelay uses milliseconds per channel.
  delay_ms="$(awk -v s="$start" "BEGIN { printf \"%d\", (s * 1000) + 0.5 }")"
  INPUTS+=(-i "$clip")
  label="ad${idx}"
  FILTERS+=("[${idx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,adelay=${delay_ms}|${delay_ms}[${label}]")
  AD_LABELS+=("[${label}]")
  idx=$((idx + 1))
done

ad_count=${#AD_LABELS[@]}
if [[ "$ad_count" -eq 1 ]]; then
  FILTERS+=("${AD_LABELS[0]}anull[admix]")
else
  joined=""
  for label in "${AD_LABELS[@]}"; do
    joined="${joined}${label}"
  done
  FILTERS+=("${joined}amix=inputs=${ad_count}:duration=longest:dropout_transition=0:normalize=0[admix]")
fi

# Pad AD so ducking/mix keep the full main duration (not truncated to last AD end).
FILTERS+=("[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono[main]")
FILTERS+=("[admix]apad[ad_padded]")
FILTERS+=("[ad_padded]asplit=2[ad_sc][ad_voice]")
FILTERS+=("[main][ad_sc]sidechaincompress=threshold=0.03:ratio=8:attack=80:release=600:makeup=1:knee=2.5:level_sc=1[ducked]")
FILTERS+=("[ducked][ad_voice]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]")

filter_complex="$(printf '%s;' "${FILTERS[@]}")"
filter_complex="${filter_complex%;}"

ffmpeg -hide_banner -y \
  "${INPUTS[@]}" \
  -filter_complex "$filter_complex" \
  -map "[out]" \
  -ac 1 \
  -ar 48000 \
  -c:a libopus \
  -b:a 24k \
  -vbr on \
  -application voip \
  "$OUT"

bytes="$(wc -c < "$OUT" | tr -d '[:space:]')"
echo "wrote $OUT (${bytes} bytes) clips=${ad_count}"
