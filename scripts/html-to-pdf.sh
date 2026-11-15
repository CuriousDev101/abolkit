#!/usr/bin/env bash
# Experimental Chromium print-to-PDF for accessible HTML (#54).
# Usage:
#   bash scripts/html-to-pdf.sh path/to/transcript.html [out.pdf]
#
# This does NOT claim PDF/UA. Chromium print-to-PDF often omits a full tag tree.
# Validate with pdfinfo / strings / a desktop checker (PAC) — see spikes/54-tagged-html-pdf/RESULT.md
set -euo pipefail

in="${1:-}"
out="${2:-}"
if [ -z "$in" ] || [ ! -f "$in" ]; then
  echo "usage: $0 <input.html> [output.pdf]" >&2
  exit 2
fi

abs_in="$(cd "$(dirname "$in")" && pwd)/$(basename "$in")"
if [ -z "$out" ]; then
  out="${abs_in%.html}.pdf"
fi
mkdir -p "$(dirname "$out")"
abs_out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"

CHROME=""
for c in chromium google-chrome-stable google-chrome chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROME="$c"
    break
  fi
done
if [ -z "$CHROME" ]; then
  echo "No Chromium/Chrome binary found on PATH." >&2
  exit 1
fi

# file:// URL for local HTML (offline pack pages).
url="file://${abs_in}"

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="$abs_out" \
  "$url" >/dev/null 2>&1

echo "wrote $abs_out"
if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "$abs_out" || true
fi
# Heuristic: Tagged PDF usually exposes /StructTreeRoot in the file.
if command -v rg >/dev/null 2>&1; then
  if rg -a -q "StructTreeRoot" "$abs_out"; then
    echo "tag_heuristic: StructTreeRoot FOUND (may still fail PAC)"
  else
    echo "tag_heuristic: StructTreeRoot NOT FOUND — treat as untagged / experimental"
  fi
elif grep -a -q "StructTreeRoot" "$abs_out" 2>/dev/null; then
  echo "tag_heuristic: StructTreeRoot FOUND (may still fail PAC)"
else
  echo "tag_heuristic: StructTreeRoot NOT FOUND — treat as untagged / experimental"
fi
