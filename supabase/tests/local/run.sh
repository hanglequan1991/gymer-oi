#!/usr/bin/env bash
# Chạy migration + test SQL trên Postgres 16 tạm. Xem README.md. KHÔNG đụng production.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${PG_TEST_PORT:-54329}"
DB=gymer_test

[ -x "$PGBIN/initdb" ] || { echo "LỖI: không thấy $PGBIN/initdb (đặt PGBIN nếu khác)."; exit 2; }

WORK="$(mktemp -d /var/tmp/gymer-pgtest.XXXXXX)"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # root không chạy được postgres: dùng user postgres, thư mục tạm phải thuộc user đó.
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 --no-sync >"$WORK/initdb.log" 2>&1 \
  || { echo "LỖI initdb:"; tail -20 "$WORK/initdb.log"; exit 3; }
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -w -l "$WORK/server.log" \
  -o "-c listen_addresses='' -c unix_socket_directories=$WORK -p $PORT" start >/dev/null \
  || { echo "LỖI khởi động Postgres:"; tail -20 "$WORK/server.log"; exit 4; }

psql_run() { "${RUN[@]}" "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }
"${RUN[@]}" "$PGBIN/createdb" -h "$WORK" -p "$PORT" -U postgres "$DB"
echo "Postgres: $(psql_run -At -c 'select version()')"

psql_run < "$HERE/shim_supabase.sql"
echo "OK: shim_supabase.sql"

shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  for pass in 1 2; do
    # -1: mỗi file một giao dịch, giống supabase db push.
    psql_run -1 < "$f" || { echo "THẤT BẠI: $(basename "$f") (lần $pass)"; exit 1; }
    echo "OK: $(basename "$f") (lần $pass)"
  done
done
for f in "$HERE"/cases/*.sql; do
  psql_run < "$f" || { echo "THẤT BẠI test: $(basename "$f")"; exit 1; }
  echo "OK test: $(basename "$f")"
done
echo "XONG: tất cả đạt."
