#!/usr/bin/env bash
# Vercel build for apps/web (Project → Settings → Build Command: `bash ../../scripts/vercel-build.sh`).
# Migrations run only for production deployments, so preview builds never change the production schema.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  echo "Applying database migrations (production)…"
  yarn db:migrate
else
  echo "Skipping migrations (VERCEL_ENV=${VERCEL_ENV:-local})."
fi

yarn turbo run build --filter=@iplan/web
