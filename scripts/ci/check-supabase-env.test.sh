#!/usr/bin/env bash
# Self-test offline cho scripts/ci/check-supabase-env.sh. Không gọi mạng.
# Cách dùng: bash scripts/ci/check-supabase-env.test.sh
# Thoát 0 nếu mọi ca đạt; khác 0 nếu có ca lỗi.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/check-supabase-env.sh"

SECRET_MARK="SECRETMARK-9d41c7"
GOOD_URL="https://abcdefgh.supabase.co"
GOOD_KEY="sb_publishable_${SECRET_MARK}"

PASS=0
FAIL=0
RC=0
OUT=""

pass() {
  PASS=$((PASS + 1))
  printf 'ok   - %s\n' "$1"
}
fail() {
  FAIL=$((FAIL + 1))
  printf 'FAIL - %s\n' "$1"
}

# Chạy script trong env sạch. Tham số: <mode>. Biến T_URL, T_KEY (đặt trước lệnh gọi) điều khiển ca.
run() {
  local mode="$1"
  set +e
  OUT="$(env -i PATH="$PATH" \
    VITE_SUPABASE_URL="${T_URL-$GOOD_URL}" \
    VITE_SUPABASE_ANON_KEY="${T_KEY-$GOOD_KEY}" \
    bash "$SCRIPT" "$mode" 2>&1)"
  RC=$?
  set -e
}

expect_rc() {
  if [[ "$RC" -eq "$2" ]]; then pass "$1 (exit $RC)"; else fail "$1 (exit $RC, mong đợi $2)"; fi
}
expect_out() {
  if grep -qF -- "$2" <<<"$OUT"; then pass "$1"; else fail "$1"; fi
}
expect_no_out() {
  if grep -qF -- "$2" <<<"$OUT"; then fail "$1"; else pass "$1"; fi
}

# 1. deploy-dev, URL rỗng => thoát 1, báo tên biến
T_URL="" run deploy-dev
expect_rc "ca 1: deploy-dev với VITE_SUPABASE_URL rỗng" 1
expect_out "ca 1: báo VITE_SUPABASE_URL đang trống" "VITE_SUPABASE_URL đang trống"

# 2. deploy-testing, URL chỉ có khoảng trắng => coi là rỗng
T_URL="   " run deploy-testing
expect_rc "ca 2: deploy-testing với URL toàn khoảng trắng" 1
expect_out "ca 2: báo URL trống" "VITE_SUPABASE_URL đang trống"

# 3. deploy-dev, URL dùng http:// => thoát 1
T_URL="http://abcdefgh.supabase.co" run deploy-dev
expect_rc "ca 3: URL dùng http://" 1
expect_out "ca 3: báo phải bắt đầu bằng https://" "phải bắt đầu bằng https://"

# 4. deploy-dev, URL không có scheme => thoát 1
T_URL="abcdefgh.supabase.co" run deploy-dev
expect_rc "ca 4: URL không có scheme" 1

# 5. deploy-dev, khóa rỗng => thoát 1, báo tên biến khóa
T_KEY="" run deploy-dev
expect_rc "ca 5: deploy-dev với VITE_SUPABASE_ANON_KEY rỗng" 1
expect_out "ca 5: báo VITE_SUPABASE_ANON_KEY đang trống" "VITE_SUPABASE_ANON_KEY đang trống"

# 6. deploy-dev, khóa toàn khoảng trắng => coi là rỗng
T_KEY="  	 " run deploy-dev
expect_rc "ca 6: khóa toàn khoảng trắng" 1

# 7. deploy-dev, cả URL và khóa sai => thoát 1 và báo đủ hai lỗi
T_URL="" T_KEY="" run deploy-dev
expect_rc "ca 7: cả URL và khóa đều thiếu" 1
expect_out "ca 7: báo lỗi URL" "VITE_SUPABASE_URL đang trống"
expect_out "ca 7: báo lỗi khóa" "VITE_SUPABASE_ANON_KEY đang trống"

# 8. Lỗi không được in giá trị khóa hay URL sai
T_URL="http://leaky-host.example" T_KEY="" run deploy-dev
expect_no_out "ca 8: không in giá trị URL" "leaky-host.example"
T_URL="ftp://${SECRET_MARK}.example" run deploy-dev
expect_rc "ca 8b: URL sai giao thức" 1
expect_no_out "ca 8b: không in phần có giá trị bí mật trong URL" "$SECRET_MARK"

# 9. Cấu hình đúng ở deploy-dev và deploy-testing => thoát 0
run deploy-dev
expect_rc "ca 9: deploy-dev với cấu hình đúng" 0
expect_no_out "ca 9: không in giá trị khóa khi đạt" "$SECRET_MARK"
run deploy-testing
expect_rc "ca 9b: deploy-testing với cấu hình đúng" 0

# 10. check và login-only không kiểm biến: thiếu hết vẫn thoát 0
T_URL="" T_KEY="" run check
expect_rc "ca 10: check không kiểm biến Supabase" 0
T_URL="" T_KEY="" run login-only
expect_rc "ca 10b: login-only không kiểm biến Supabase" 0

# 11. Chế độ không hợp lệ => thoát 2
run push-only
expect_rc "ca 11: chế độ không hợp lệ" 2

# Kiểm tĩnh
if bash -n "$SCRIPT"; then
  pass "bash -n đạt"
else
  fail "bash -n lỗi"
fi
if grep -vE '^[[:space:]]*#' "$SCRIPT" | grep -qE 'set -[a-zA-Z]*x|xtrace'; then
  fail "phát hiện set -x hoặc xtrace ngoài dòng comment"
else
  pass "không có set -x hoặc xtrace"
fi

printf '\nKết quả: %d ca đạt, %d ca lỗi.\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
