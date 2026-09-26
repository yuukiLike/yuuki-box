#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
bash ../shared/native/build.sh
bash ../shared/runtime/build.sh
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi
pnpm run build
