#!/usr/bin/env bash
# Quét migration để cảnh báo các thao tác có thể phá hủy dữ liệu.
# CHỈ CẢNH BÁO: luôn thoát 0 (trừ khi đối số trỏ tới đường dẫn không tồn tại), không chặn deploy.
# Đây là gợi ý cho người duyệt, không phải cổng bảo vệ (dễ bị lách).
#
# Cách dùng:
#   scan-migrations.sh                      quét toàn bộ supabase/migrations/*.sql
#                                           (gồm cả migration đã áp dụng)
#   scan-migrations.sh <file|thư mục> ...   quét các file/thư mục chỉ định (*.sql)
#
# Job plan-migrate truyền vào các file mà `supabase db push --dry-run` liệt kê là đang chờ.
set -euo pipefail

PATTERN='drop[[:space:]]+table|drop[[:space:]]+column|truncate|alter[[:space:]]+column.*[[:space:]]type|delete[[:space:]]+from'

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

files=()

if [[ $# -gt 0 ]]; then
  for arg in "$@"; do
    if [[ -d "$arg" ]]; then
      while IFS= read -r f; do
        files+=("$f")
      done < <(find "$arg" -maxdepth 1 -type f -name '*.sql' | sort)
    elif [[ -f "$arg" ]]; then
      files+=("$arg")
    else
      echo "Lỗi: không tìm thấy file hoặc thư mục: $arg" >&2
      exit 1
    fi
  done
else
  echo "Quét toàn bộ migration (gồm cả migration đã áp dụng)."
  while IFS= read -r f; do
    files+=("$f")
  done < <(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' 2>/dev/null | sort)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "Không có file migration nào để quét."
  exit 0
fi

count=0
for f in "${files[@]}"; do
  if matches="$(grep -n -i -E "$PATTERN" -- "$f")"; then
    while IFS= read -r line; do
      echo "CẢNH BÁO [$f] dòng $line"
      count=$((count + 1))
    done <<< "$matches"
  fi
done

if [[ $count -eq 0 ]]; then
  echo "Đã quét ${#files[@]} file migration: không thấy mẫu nguy hiểm."
else
  echo "Tổng cộng $count cảnh báo trong ${#files[@]} file migration (chỉ để người duyệt chú ý; không chặn deploy)."
fi
exit 0
