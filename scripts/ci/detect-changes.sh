#!/usr/bin/env bash
# Xác định có migration (supabase/migrations/*.sql), có edge function để deploy, và có thay đổi ứng dụng Zalo hay không.
#
# has_migrations và has_functions CHỈ báo SỰ HIỆN DIỆN, không dùng git diff. Trạng thái migration thật sự chờ áp dụng
# do `supabase db push --dry-run` (job plan-migrate) quyết định, vì nó đọc trạng thái DB.
#
# has_app là đầu ra DUY NHẤT dựa trên diff: `git diff --no-renames --name-only <before> <sha>` so với tập đường dẫn
# của ứng dụng Zalo Mini App (xem is_app_path). Fail-safe: nếu không diff được thì has_app=true.
# Các trường hợp -> has_app=true: không phải sự kiện push; before toàn số 0; commit before không có trong clone;
# git diff lỗi. Chỉ has_app=false khi là push, diff thành công và không file nào thuộc tập ứng dụng.
#
# Biến môi trường (CI đặt; khi chạy cục bộ có thể bỏ trống):
#   EVENT_NAME  github.event_name (push | workflow_dispatch | ...)
#   BEFORE_SHA  github.event.before (commit trước khi push)
#   HEAD_SHA    github.sha (mặc định HEAD khi chạy cục bộ)
#
# Output:
#   has_migrations=true|false  có ít nhất một file *.sql trực tiếp trong supabase/migrations/
#   has_functions=true|false   có ít nhất một thư mục con trong supabase/functions/ không bắt đầu bằng "_"
#   has_app=true|false         xem ở trên
#   - Ghi vào $GITHUB_OUTPUT nếu biến này tồn tại (trong GitHub Actions).
#   - Luôn in ra stdout để đọc khi chạy cục bộ. Lý do của has_app in ra stderr.
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

# Tập đường dẫn thuộc ứng dụng Zalo Mini App (khớp với A4 của docs/plans/zalo-deploy-job.md).
is_app_path() {
  case "$1" in
    src/*|assets/*|tools/zmp-cli/*|scripts/ci/zalo-*) return 0 ;;
    index.html|vite.config.ts|app-config.json|package.json|package-lock.json|tsconfig.json|.nvmrc) return 0 ;;
    .github/workflows/deploy.yml|.github/workflows/ci.yml) return 0 ;;
  esac
  return 1
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

has_app=true
app_reason="fail-safe: không phải push hoặc không diff được"
if [[ "${EVENT_NAME:-}" == "push" ]]; then
  before="${BEFORE_SHA:-}"
  head="${HEAD_SHA:-HEAD}"
  if [[ ! "$before" =~ ^[0-9a-f]{40}$ || "$before" =~ ^0+$ ]]; then
    app_reason="fail-safe: before không phải SHA hợp lệ (có thể là commit đầu tiên của nhánh)"
  elif ! git -C "$repo_root" cat-file -e "${before}^{commit}" 2>/dev/null; then
    app_reason="fail-safe: commit before không có trong clone"
  elif changed="$(git -C "$repo_root" diff --no-renames --name-only "$before" "$head" 2>/dev/null)"; then
    has_app=false
    app_reason="diff thành công, không có file ứng dụng nào đổi"
    while IFS= read -r f; do
      if [[ -n "$f" ]] && is_app_path "$f"; then
        has_app=true
        app_reason="file ứng dụng đổi: $f"
        break
      fi
    done <<< "$changed"
  else
    app_reason="fail-safe: git diff lỗi"
  fi
fi
echo "has_app: $app_reason" >&2

emit has_migrations "$has_migrations"
emit has_functions "$has_functions"
emit has_app "$has_app"
