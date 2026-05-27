#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf "[mobile-check] TypeScript...\n"
npx -p typescript tsc --noEmit

node scripts/check-env-config.mjs

printf "[mobile-check] iOS bundle...\n"
npx expo export --platform ios --dump-sourcemap >/dev/null 2>&1
rm -rf dist

printf "[mobile-check] OK\n"
