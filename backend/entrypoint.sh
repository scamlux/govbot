#!/bin/sh
set -e

# Wait for Postgres to accept connections (best-effort; skipped if host unset).
if [ -n "$POSTGRES_HOST" ]; then
  echo "Waiting for database at $POSTGRES_HOST:${POSTGRES_PORT:-5432}…"
  until python -c "import socket,sys; s=socket.socket(); s.settimeout(2); \
    sys.exit(0) if s.connect_ex(('$POSTGRES_HOST', int('${POSTGRES_PORT:-5432}')))==0 else sys.exit(1)" 2>/dev/null; do
    sleep 1
  done
  echo "Database is up."
fi

echo "Applying migrations…"
python manage.py migrate --noinput

echo "Seeding scenario catalog…"
python manage.py seed_scenarios || true

echo "Collecting static files…"
python manage.py collectstatic --noinput || true

exec "$@"
