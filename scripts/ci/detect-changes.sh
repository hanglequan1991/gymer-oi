#!/usr/bin/env bash
# Xác định có migration (supabase/migrations/*.sql) và có edge function để deploy hay không.
#
# Chỉ báo SỰ HIỆN DIỆN, không dùng git diff. Trạng thái migration thật sự chờ áp dụng
# do `supabase db push --dry-run` (job plan-migrate) quyết định, vì nó đọc trạng thái DB.
#
# Output:
#   has_migrations=true|false  có ít nhất một file *.sql trực tiếp trong supabase/migrations/
#   has_functions=true|false   có ít nhất một thư mục con trong supabase/functions/ không bắt đầu bằng "_"
#   - Ghi vào $GITHUB_OUTPUT nếu biến này tồn tại (trong GitHub Actions).
#   - Luôn in ra stdout để đọc khi chạy cục bộ.
# Thư mục không tồn tại hoặc rỗng: false, không báo lỗi.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

emit() {
  local key="$1"
  local value="$2"
  echo "${key}=${value}"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "${key}=${value}" >> "$GITHUB_OUTPUT"
  fi
}

has_migrations=false
if [[ -d "$repo_root/supabase/migrations" ]] \
  && [[ -n "$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print -quit)" ]]; then
  has_migrations=true
fi

has_functions=false
if [[ -d "$repo_root/supabase/functions" ]] \
  && [[ -n "$(find "$repo_root/supabase/functions" -mindepth 1 -maxdepth 1 -type d ! -name '_*' -print -quit)" ]]; then
  has_functions=true
fi

emit has_migrations "$has_migrations"
emit has_functions "$has_functions"
