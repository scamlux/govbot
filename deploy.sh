#!/usr/bin/env bash
# ===========================================================================
# GovBot — server deploy script. Pulls latest main and (re)builds the prod
# stack. Safe to run repeatedly; only rebuilds what changed.
#
#   APP_DIR=/opt/govbot ./deploy.sh
# ===========================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/govbot}"
COMPOSE="docker compose -f docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Fetching latest from origin/main"
git fetch --all --quiet
git reset --hard origin/main

echo "==> Building and starting containers"
$COMPOSE up -d --build

echo "==> Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Status"
$COMPOSE ps

echo "==> Health check (waiting for backend startup: migrate/seed/collectstatic)"
PORT="${PUBLIC_PORT:-6969}"
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/api/health/" >/dev/null 2>&1; then
    echo "✅ GovBot is healthy on port ${PORT} (after ~$((i*3))s)"
    exit 0
  fi
  sleep 3
done
echo "⚠️  Health check failed after ~90s — see: $COMPOSE logs --tail=50"
exit 1
