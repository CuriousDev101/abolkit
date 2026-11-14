#!/usr/bin/env bash
# Source this (or run via: source scripts/dev-env.sh) to put project pnpm on PATH.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT/.tools/node_modules/.bin:$PATH"
export PNPM_HOME="$ROOT/.tools/pnpm-home"
echo "abolkit env: node=$(node -v) pnpm=$(pnpm -v) ffmpeg=$(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3)"
