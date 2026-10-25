#!/usr/bin/env bash
# Kiểm biến build Supabase trước khi build bản đẩy lên Zalo. Chạy offline, không gọi mạng.
# Dùng trong bước "Build bản Supabase" của job `zalo` (deploy.yml).
#
# Cách dùng: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
#              bash scripts/ci/check-supabase-env.sh <check|login-only|deploy-dev|deploy-testing>
#
# Env:
#   VITE_SUPABASE_URL       Bắt buộc ở chế độ deploy-*: không rỗng và bắt đầu bằng https://.
#   VITE_SUPABASE_ANON_KEY  Bắt buộc ở chế độ deploy-*: không rỗng.
#
# Hành vi:
#   - deploy-dev, deploy-testing: thiếu hoặc sai điều kiện thì thoát 1 (không build).
#   - check, login-only: không kiểm ở đây (không đổi hành vi); thoát 0.
#   - Không in giá trị khóa hay URL. Chỉ in tên biến.
#
# Mã thoát: 0 đạt hoặc không cần kiểm; 1 thiếu/sai biến ở chế độ deploy-*; 2 chế độ không hợp lệ.
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  check | login-only) exit 0 ;;
  deploy-dev | deploy-testing) ;;
  *)
    echo "::error::Chế độ không hợp lệ cho kiểm biến Supabase: '${MODE}'."
    exit 2
    ;;
esac

# Cắt khoảng trắng đầu/cuối để chuỗi toàn khoảng trắng được coi là rỗng.
url="${VITE_SUPABASE_URL:-}"
url="${url#"${url%%[![:space:]]*}"}"
url="${url%"${url##*[![:space:]]}"}"
key="${VITE_SUPABASE_ANON_KEY:-}"
key="${key#"${key%%[![:space:]]*}"}"
key="${key%"${key##*[![:space:]]}"}"

failed=0
if [[ -z "$url" ]]; then
  echo "::error::VITE_SUPABASE_URL đang trống. Đặt Variable VITE_SUPABASE_URL trước khi đẩy lên Zalo (chế độ '${MODE}')."
  failed=1
elif [[ "$url" != https://* ]]; then
  echo "::error::VITE_SUPABASE_URL phải bắt đầu bằng https:// (chế độ '${MODE}'). Kiểm tra lại Variable VITE_SUPABASE_URL."
  failed=1
fi

if [[ -z "$key" ]]; then
  echo "::error::VITE_SUPABASE_ANON_KEY đang trống. Đặt Secret VITE_SUPABASE_ANON_KEY trước khi đẩy lên Zalo (chế độ '${MODE}')."
  failed=1
fi

if (( failed != 0 )); then
  exit 1
fi

echo "Biến Supabase cho chế độ '${MODE}' đạt kiểm tra (VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY đều có giá trị)."
exit 0
